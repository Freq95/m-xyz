import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { searchQuerySchema } from '@/lib/validations/post';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError } from '@/lib/errors';

/**
 * GET /api/search - Search posts in a neighborhood
 * Uses PostgreSQL ILIKE for simple text matching (no full-text search setup required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const query = searchQuerySchema.parse({
      q: searchParams.get('q'),
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
