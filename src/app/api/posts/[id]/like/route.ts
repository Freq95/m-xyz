import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
} from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin } from '@/lib/csrf';
import { saveRateLimit } from '@/lib/rate-limit';
import { invalidateFeedCache } from '@/lib/redis/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/posts/[id]/like - Like a post
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    const { id: postId } = await context.params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    // Apply rate limiting (reuse save rate limit: 60/hour)
    if (saveRateLimit) {
      const { success } = await saveRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Prea multe aprecieri. Încearcă din nou peste puțin.');
      }
    }

    // Check if post exists and is not deleted
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        status: true,
        authorId: true,
      },
    });

    if (!post || post.status === 'deleted') {
      throw new NotFoundError('Postarea');
    }

    // Create like and increment count in transaction
    // Use createMany to avoid error if already liked (idempotent)
    const result = await prisma.$transaction(async (tx) => {
      // Try to create like
      const created = await tx.postLike.createMany({
        data: {
          userId: user.id,
          postId,
        },
        skipDuplicates: true,
      });

      // Only increment if like was actually created
      if (created.count > 0) {
        await tx.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        });

        // TODO: Create notification for post author
        // await createNotification({
        //   userId: post.authorId,
        //   type: 'POST_LIKED',
        //   title: 'Apreciere nouă',
        //   body: `Cineva a apreciat postarea ta`,
        //   data: { postId },
        // });
      }

      return { created: created.count > 0 };
    });

    // Invalidate feed cache if like was created (likeCount changed)
    if (result.created) {
      await invalidateFeedCache();
    }

    return successResponse({
      liked: true,
      wasNew: result.created,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/posts/[id]/like - Unlike a post
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    const { id: postId } = await context.params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    // Apply rate limiting (reuse save rate limit: 60/hour)
    if (saveRateLimit) {
      const { success } = await saveRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Prea multe acțiuni. Încearcă din nou peste puțin.');
      }
    }

    // Delete like and decrement count in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Try to delete like
      const deleted = await tx.postLike.deleteMany({
        where: {
          userId: user.id,
          postId,
        },
      });

      // Only decrement if like was actually deleted
      if (deleted.count > 0) {
        await tx.post.updateMany({
          where: {
            id: postId,
            likeCount: { gt: 0 }, // Prevent negative counts
          },
          data: { likeCount: { decrement: 1 } },
        });
      }

      return { deleted: deleted.count > 0 };
    });

    // Invalidate feed cache if like was deleted (likeCount changed)
    if (result.deleted) {
      await invalidateFeedCache();
    }

    return successResponse({
      liked: false,
      wasDeleted: result.deleted,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
