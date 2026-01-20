import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { createPostSchema, postQuerySchema } from '@/lib/validations/post';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import {
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  NotFoundError,
} from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { postRateLimit, getClientIp } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize';

/**
 * GET /api/posts - Get posts feed for a neighborhood
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const query = postQuerySchema.parse({
      neighborhood: searchParams.get('neighborhood'),
      category: searchParams.get('category') || undefined,
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || 20,
    });

    // Find neighborhood by slug
    const neighborhood = await prisma.neighborhood.findUnique({
      where: { slug: query.neighborhood },
    });

    if (!neighborhood) {
      throw new NotFoundError('Cartierul');
    }

    // Build cursor condition for pagination
    const cursorCondition = query.cursor
      ? { createdAt: { lt: (await prisma.post.findUnique({ where: { id: query.cursor } }))?.createdAt } }
      : {};

    // Fetch posts
    const posts = await prisma.post.findMany({
      where: {
        neighborhoodId: neighborhood.id,
        status: 'active',
        ...(query.category && { category: query.category }),
        ...cursorCondition,
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
      take: query.limit + 1, // Fetch one extra to check if there are more
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
          take: 4, // Max 4 images per post preview
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    // Check if there are more posts
    const hasMore = posts.length > query.limit;
    const postsToReturn = hasMore ? posts.slice(0, -1) : posts;
    const nextCursor = hasMore ? postsToReturn[postsToReturn.length - 1]?.id : undefined;

    return successResponse(
      postsToReturn.map((post) => ({
        id: post.id,
        title: post.title,
        body: post.body,
        category: post.category,
        priceCents: post.priceCents,
        currency: post.currency,
        isFree: post.isFree,
        isPinned: post.isPinned,
        commentCount: post._count.comments,
        viewCount: post.viewCount,
        createdAt: post.createdAt,
        author: {
          id: post.author.id,
          name: post.author.displayName || post.author.fullName,
          avatarUrl: post.author.avatarUrl,
        },
        images: post.images.map((img) => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
        })),
      })),
      { cursor: nextCursor, hasMore }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/posts - Create a new post
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    // Check rate limit
    if (postRateLimit) {
      const { success } = await postRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Ai atins limita de postări. Încearcă din nou mai târziu.');
      }
    }

    // Get user from database to check neighborhood and ban status
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        neighborhoodId: true,
        isBanned: true,
        fullName: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    if (!dbUser) {
      throw new AuthenticationError('Contul nu a fost găsit');
    }

    if (dbUser.isBanned) {
      throw new AuthorizationError('Contul tău a fost suspendat');
    }

    if (!dbUser.neighborhoodId) {
      throw new AuthorizationError('Trebuie să selectezi un cartier pentru a posta');
    }

    // Parse and validate input
    const body = await request.json();
    const validatedData = createPostSchema.parse(body);

    // Sanitize text content to prevent XSS
    const sanitizedTitle = validatedData.title ? sanitizeText(validatedData.title) : null;
    const sanitizedBody = sanitizeText(validatedData.body);

    // Validate sanitized content still meets requirements
    if (sanitizedBody.length < 10) {
      throw new AuthorizationError('Conținutul este prea scurt după curățare');
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        neighborhoodId: dbUser.neighborhoodId,
        authorId: dbUser.id,
        title: sanitizedTitle,
        body: sanitizedBody,
        category: validatedData.category,
        priceCents: validatedData.priceCents,
        isFree: validatedData.isFree ?? false,
        // Set expiry for marketplace posts (30 days)
        expiresAt:
          ['SELL', 'BUY', 'SERVICE'].includes(validatedData.category)
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : null,
      },
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
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      priceCents: post.priceCents,
      currency: post.currency,
      isFree: post.isFree,
      createdAt: post.createdAt,
      author: {
        id: post.author.id,
        name: post.author.displayName || post.author.fullName,
        avatarUrl: post.author.avatarUrl,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
