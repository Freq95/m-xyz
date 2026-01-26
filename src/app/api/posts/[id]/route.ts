import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { updatePostSchema } from '@/lib/validations/post';
import { validateOrigin } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/posts/[id] - Get a single post by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

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
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!post || post.status === 'deleted') {
      throw new NotFoundError('Postarea');
    }

    // Increment view count (fire and forget)
    prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});

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
      commentCount: post._count.comments,
      viewCount: post.viewCount,
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

    // Parse and validate input
    const body = await request.json();
    const validatedData = updatePostSchema.parse(body);

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
      },
    });

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

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/posts/[id] error:', error);
    return handleApiError(error);
  }
}
