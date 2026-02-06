import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { isUserBlocked } from '@/lib/services/block.service';
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

    // Check if id is a UUID (old format) or username (new format)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // Check if user exists
    const user = await prisma.user.findFirst({
      where: isUUID ? { id } : { username: id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundError('Utilizatorul');
    }

    // Get current user (optional - for block check)
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    // Check if there's a block relationship (either direction)
    if (currentUser && currentUser.id !== user.id) {
      const blocked = await isUserBlocked(currentUser.id, user.id);
      if (blocked) {
        throw new NotFoundError('Utilizatorul');
      }
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

    // Fetch user's posts (use user.id, not id param, since id param could be username)
    const posts = await prisma.post.findMany({
      where: {
        authorId: user.id,
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
            username: true,
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
      },
    });

    // Check if there are more posts
    const hasMore = posts.length > query.limit;
    const postsToReturn = hasMore ? posts.slice(0, -1) : posts;
    const nextCursor = hasMore ? postsToReturn[postsToReturn.length - 1]?.id : undefined;

    // Check which posts the current user has liked and saved (reuse currentUser from block check above)
    let likedPostIds = new Set<string>();
    let savedPostIds = new Set<string>();
    if (currentUser && postsToReturn.length > 0) {
      const [likes, saved] = await Promise.all([
        prisma.postLike.findMany({
          where: {
            userId: currentUser.id,
            postId: { in: postsToReturn.map(p => p.id) },
          },
          select: { postId: true },
        }),
        prisma.savedPost.findMany({
          where: {
            userId: currentUser.id,
            postId: { in: postsToReturn.map(p => p.id) },
          },
          select: { postId: true },
        }),
      ]);
      likedPostIds = new Set(likes.map(like => like.postId));
      savedPostIds = new Set(saved.map(save => save.postId));
    }

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
        commentCount: post.commentCount,
        viewCount: post.viewCount,
        likeCount: post.likeCount,
        isLiked: likedPostIds.has(post.id),
        isSaved: savedPostIds.has(post.id),
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
