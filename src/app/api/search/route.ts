import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { searchQuerySchema } from '@/lib/validations/post';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError, RateLimitError } from '@/lib/errors';
import { searchRateLimit, getClientIp } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { getBlockedUserIds } from '@/lib/services/block.service';
import { redis, CACHE_TTL } from '@/lib/redis/client';

/**
 * GET /api/search - Search posts in a neighborhood
 * Uses PostgreSQL ILIKE for simple text matching (no full-text search setup required)
 */
export async function GET(request: NextRequest) {
  try {
    // Check rate limit (IP-based since search is public)
    if (searchRateLimit) {
      const identifier = getClientIp(request);
      const { success } = await searchRateLimit.limit(identifier);
      if (!success) {
        throw new RateLimitError('Ai atins limita de căutări. Încearcă din nou mai târziu.');
      }
    }

    const { searchParams } = new URL(request.url);

    // Get authenticated user (optional for search)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // Get list of blocked user IDs (if authenticated) - uses Redis cache
    const blockedUserIds = userId ? await getBlockedUserIds(userId) : [];

    // Parse and validate query parameters
    const query = searchQuerySchema.parse({
      q: searchParams.get('q'),
      neighborhood: searchParams.get('neighborhood'),
      category: searchParams.get('category') || undefined,
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || 20,
    });

    // Find neighborhood by slug (only select ID for filtering)
    const neighborhood = await prisma.neighborhood.findUnique({
      where: { slug: query.neighborhood },
      select: { id: true },
    });

    if (!neighborhood) {
      throw new NotFoundError('Cartierul');
    }

    // Build cache key for search (only cache page 1, anonymous users)
    const shouldCache = redis && !query.cursor && !userId;
    const cacheKey = shouldCache
      ? `search:${query.neighborhood}:${query.category || 'all'}:${query.q}`
      : null;

    // Check cache
    if (shouldCache && cacheKey && redis) {
      const cached = await redis.get(cacheKey) as { data: any; meta?: any } | null;
      if (cached && cached.data) {
        console.log('✓ SEARCH CACHE HIT:', cacheKey);
        return successResponse(cached.data, cached.meta || {});
      }
      console.log('✗ SEARCH CACHE MISS:', cacheKey);
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

    // Search using ILIKE for simple text matching
    // This works without any special database setup

    const posts = await prisma.post.findMany({
      where: {
        neighborhoodId: neighborhood.id,
        status: 'active',
        ...(query.category && { category: query.category }),
        ...(blockedUserIds.length > 0 && {
          authorId: { notIn: blockedUserIds },
        }),
        ...cursorCondition,
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { body: { contains: query.q, mode: 'insensitive' } },
        ],
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' },
      ],
      take: query.limit + 1,
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
          take: 4,
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
        commentCount: post.commentCount,
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

    // Store in cache (5 minute TTL for search results)
    if (shouldCache && cacheKey && redis) {
      const cacheData = {
        data: responseData,
        meta: { cursor: nextCursor, hasMore }
      };
      await redis.set(cacheKey, cacheData, { ex: 300 }); // 5 minutes
    }

    return successResponse(responseData, { cursor: nextCursor, hasMore });
  } catch (error) {
    return handleApiError(error);
  }
}
