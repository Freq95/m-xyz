import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthenticationError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { getBlockedUserIds } from '@/lib/services/block.service';

const savedPostsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /api/posts/saved - Get user's saved posts
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    const { searchParams } = new URL(request.url);

    // Parse query params
    const query = savedPostsQuerySchema.parse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || 20,
    });

    // Get blocked user IDs to filter out
    const blockedUserIds = await getBlockedUserIds(user.id);

    // Build cursor condition for pagination
    let cursorCondition = {};
    if (query.cursor) {
      const cursorSavedPost = await prisma.savedPost.findFirst({
        where: { userId: user.id, postId: query.cursor },
        select: { createdAt: true }
      });
      if (cursorSavedPost?.createdAt) {
        cursorCondition = { createdAt: { lt: cursorSavedPost.createdAt } };
      }
    }

    // Fetch saved posts (excluding posts from blocked users)
    const savedPosts = await prisma.savedPost.findMany({
      where: {
        userId: user.id,
        ...cursorCondition,
        post: {
          status: 'active',
          authorId: blockedUserIds.length > 0 ? { notIn: blockedUserIds } : undefined,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
      include: {
        post: {
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
          },
        },
      },
    });

    // Check if there are more posts
    const hasMore = savedPosts.length > query.limit;
    const postsToReturn = hasMore ? savedPosts.slice(0, -1) : savedPosts;
    const nextCursor = hasMore ? postsToReturn[postsToReturn.length - 1]?.postId : undefined;

    // Check which posts the user has liked
    let likedPostIds = new Set<string>();
    if (postsToReturn.length > 0) {
      const likes = await prisma.postLike.findMany({
        where: {
          userId: user.id,
          postId: { in: postsToReturn.map(sp => sp.post.id) },
        },
        select: { postId: true },
      });
      likedPostIds = new Set(likes.map(like => like.postId));
    }

    return successResponse(
      postsToReturn.map((saved) => ({
        id: saved.post.id,
        title: saved.post.title,
        body: saved.post.body,
        category: saved.post.category,
        priceCents: saved.post.priceCents,
        currency: saved.post.currency,
        isFree: saved.post.isFree,
        isPinned: saved.post.isPinned,
        commentCount: saved.post.commentCount,
        viewCount: saved.post.viewCount,
        likeCount: saved.post.likeCount,
        isLiked: likedPostIds.has(saved.post.id),
        isSaved: true, // Always true for saved posts
        createdAt: saved.post.createdAt,
        savedAt: saved.createdAt,
        author: {
          id: saved.post.author.id,
          name: saved.post.author.displayName || saved.post.author.fullName,
          avatarUrl: saved.post.author.avatarUrl,
        },
        neighborhood: {
          id: saved.post.neighborhood.id,
          name: saved.post.neighborhood.name,
          slug: saved.post.neighborhood.slug,
        },
        images: saved.post.images.map((img) => ({
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
