import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError } from '@/lib/errors';
import { z } from 'zod';

const userPostsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /api/users/[id]/posts - Get user's public posts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    // Parse query params
    const query = userPostsQuerySchema.parse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || 20,
    });

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundError('Utilizatorul');
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

    // Fetch user's posts
    const posts = await prisma.post.findMany({
      where: {
        authorId: id,
        status: 'active',
        ...cursorCondition,
      },
      orderBy: { createdAt: 'desc' },
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
        neighborhood: {
          select: {
            id: true,
            name: true,
            slug: true,
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
        neighborhood: {
          id: post.neighborhood.id,
          name: post.neighborhood.name,
          slug: post.neighborhood.slug,
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
