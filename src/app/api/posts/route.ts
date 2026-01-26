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
import { postRateLimit } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize';
import { redis, CACHE_KEYS, CACHE_TTL, invalidateFeedCache } from '@/lib/redis/client';

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

    // Only cache first page (no cursor)
    const shouldCache = redis && !query.cursor;
    const cacheKey = shouldCache
      ? CACHE_KEYS.FEED({
          neighborhoodSlug: query.neighborhood,
          categorySlug: query.category,
        })
      : null;

    // Try to get from cache
    if (shouldCache && cacheKey && redis) {
      const cached = await redis.get<{ data: any[]; meta: { cursor?: string; hasMore: boolean } }>(cacheKey);
      if (cached) {
        return successResponse(cached.data, cached.meta);
      }
    }

    // Find neighborhood by slug
    const neighborhood = await prisma.neighborhood.findUnique({
      where: { slug: query.neighborhood },
    });

    if (!neighborhood) {
      throw new NotFoundError('Cartierul');
    }

    // Build cursor condition for pagination
    let cursorCondition = {};
    if (query.cursor) {
      const cursorPost = await prisma.post.findUnique({
        where: { id: query.cursor },
        select: { createdAt: true }
      });
      if (cursorPost?.createdAt) {
        cursorCondition = { createdAt: { lt: cursorPost.createdAt } };
      }
    }

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

    // Format response data
    const responseData = postsToReturn.map((post) => ({
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
    }));

    // Store in cache (with metadata)
    if (shouldCache && cacheKey && redis) {
      const cacheData = {
        data: responseData,
        meta: { cursor: nextCursor, hasMore }
      };
      await redis.set(cacheKey, cacheData, { ex: CACHE_TTL.FEED });
    }

    return successResponse(responseData, { cursor: nextCursor, hasMore });
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

    // Invalidate feed cache since new post was created
    await invalidateFeedCache();

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
    console.error('POST /api/posts error:', error);
    return handleApiError(error);
  }
}
