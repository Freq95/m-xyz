import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { updatePostSchema, IMAGE_VALIDATION } from '@/lib/validations/post';
import { validateOrigin } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize';
import { invalidateFeedCache } from '@/lib/redis/client';
import { uploadPostImage, deletePostImage } from '@/lib/supabase/storage';
import { isUserBlocked } from '@/lib/services/block.service';
import { readRateLimit } from '@/lib/rate-limit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/posts/[id] - Get a single post by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Get authenticated user (optional)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // Rate limiting for read operations (300 reads per minute)
    if (readRateLimit && userId) {
      const { success } = await readRateLimit.limit(userId);
      if (!success) {
        throw new RateLimitError('Prea multe cereri. Încearcă din nou peste puțin.');
      }
    }

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        neighborhood: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        images: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!post || post.status === 'deleted') {
      throw new NotFoundError('Postarea');
    }

    // Check if there's a block relationship between current user and post author (either direction)
    if (userId && userId !== post.authorId) {
      const blocked = await isUserBlocked(userId, post.authorId);
      if (blocked) {
        throw new NotFoundError('Postarea');
      }
    }

    // Check if current user has liked the post
    let isLiked = false;
    if (userId) {
      const like = await prisma.postLike.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: id,
          },
        },
      });
      isLiked = !!like;
    }

    // Check if current user has saved the post
    let isSaved = false;
    if (userId) {
      const saved = await prisma.savedPost.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: id,
          },
        },
      });
      isSaved = !!saved;
    }

    // Increment view count (fire and forget)
    prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    }).catch((error) => {
      console.error('Failed to increment view count:', error);
    });

    return successResponse({
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      priceCents: post.priceCents,
      currency: post.currency,
      isFree: post.isFree,
      isPinned: post.isPinned,
      status: post.status,
      commentCount: post.commentCount,
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      isLiked,
      isSaved,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: {
        id: post.author.id,
        name: post.author.displayName || post.author.fullName,
        avatarUrl: post.author.avatarUrl,
      },
      neighborhood: post.neighborhood,
      images: post.images.map((img) => ({
        id: img.id,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        width: img.width,
        height: img.height,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/posts/[id] - Update a post (author only)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    const { id } = await context.params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    // Find the post
    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true, status: true },
    });

    if (!post || post.status === 'deleted') {
      throw new NotFoundError('Postarea');
    }

    // Check ownership
    if (post.authorId !== user.id) {
      throw new AuthorizationError('Nu poți modifica această postare');
    }

    // Check content type to determine if FormData or JSON
    const contentType = request.headers.get('content-type') || '';
    const isFormData = contentType.includes('multipart/form-data');

    let validatedData;
    let imageFile: File | null = null;
    let removeImage = false;

    if (isFormData) {
      // Parse FormData
      const formData = await request.formData();
      const title = formData.get('title') as string;
      const body = formData.get('body') as string;
      const category = formData.get('category') as string;
      const priceCents = formData.get('priceCents') as string;
      const isFree = formData.get('isFree') as string;
      const image = formData.get('image') as File | null;
      const removeImageFlag = formData.get('removeImage') as string;

      // Validate data
      validatedData = updatePostSchema.parse({
        title: title || undefined,
        body,
        category,
        priceCents: priceCents ? parseInt(priceCents) : undefined,
        isFree: isFree === 'true',
      });

      imageFile = image;
      removeImage = removeImageFlag === 'true';

      // Validate image if provided
      if (imageFile) {
        if (imageFile.size > IMAGE_VALIDATION.MAX_SIZE) {
          throw new ValidationError(`Imaginea este prea mare. Mărimea maximă este ${IMAGE_VALIDATION.MAX_SIZE / (1024 * 1024)}MB`);
        }
        if (!IMAGE_VALIDATION.ALLOWED_TYPES.includes(imageFile.type as any)) {
          throw new ValidationError('Format invalid. Folosește JPG, PNG sau WebP');
        }
      }
    } else {
      // Parse JSON
      const body = await request.json();
      validatedData = updatePostSchema.parse(body);
    }

    // Sanitize text content
    const updateData: Record<string, unknown> = {};
    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title ? sanitizeText(validatedData.title) : null;
    }
    if (validatedData.body !== undefined) {
      updateData.body = sanitizeText(validatedData.body);
    }
    if (validatedData.category !== undefined) {
      updateData.category = validatedData.category;
    }
    if (validatedData.priceCents !== undefined) {
      updateData.priceCents = validatedData.priceCents;
    }
    if (validatedData.isFree !== undefined) {
      updateData.isFree = validatedData.isFree;
    }
    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;
    }

    // Handle image operations
    const existingImages = await prisma.postImage.findMany({
      where: { postId: id },
    });

    // Remove existing image if requested
    if (removeImage && existingImages.length > 0) {
      for (const img of existingImages) {
        await deletePostImage(img.url);
        await prisma.postImage.delete({ where: { id: img.id } });
      }
    }

    // Upload new image if provided
    if (imageFile) {
      // Delete old images first
      for (const img of existingImages) {
        await deletePostImage(img.url);
        await prisma.postImage.delete({ where: { id: img.id } });
      }

      // Upload new image
      const { url, thumbnailUrl, width, height, sizeBytes } = await uploadPostImage(imageFile, user.id);
      await prisma.postImage.create({
        data: {
          postId: id,
          url,
          thumbnailUrl,
          width,
          height,
          sizeBytes,
          position: 0,
        },
      });
    }

    // Update post
    const updatedPost = await prisma.post.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        images: {
          orderBy: { position: 'asc' },
        },
      },
    });

    // Invalidate feed cache since post was updated
    await invalidateFeedCache();

    return successResponse({
      id: updatedPost.id,
      title: updatedPost.title,
      body: updatedPost.body,
      category: updatedPost.category,
      priceCents: updatedPost.priceCents,
      currency: updatedPost.currency,
      isFree: updatedPost.isFree,
      status: updatedPost.status,
      updatedAt: updatedPost.updatedAt,
      author: {
        id: updatedPost.author.id,
        name: updatedPost.author.displayName || updatedPost.author.fullName,
        avatarUrl: updatedPost.author.avatarUrl,
      },
      images: updatedPost.images.map((img) => ({
        id: img.id,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        width: img.width,
        height: img.height,
      })),
    });
  } catch (error) {
    console.error('PATCH /api/posts/[id] error:', error);
    return handleApiError(error);
  }
}

/**
 * DELETE /api/posts/[id] - Delete a post (author only, soft delete)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    const { id } = await context.params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    // Find the post
    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true, status: true },
    });

    if (!post || post.status === 'deleted') {
      throw new NotFoundError('Postarea');
    }

    // Check ownership (or admin)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (post.authorId !== user.id && dbUser?.role !== 'admin') {
      throw new AuthorizationError('Nu poți șterge această postare');
    }

    // Soft delete
    await prisma.post.update({
      where: { id },
      data: { status: 'deleted' },
    });

    // Invalidate feed cache since post was deleted
    await invalidateFeedCache();

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/posts/[id] error:', error);
    return handleApiError(error);
  }
}
