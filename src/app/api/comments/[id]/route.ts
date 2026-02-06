import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { updateCommentSchema } from '@/lib/validations/comment';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize';
import { invalidateFeedCache } from '@/lib/redis/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/comments/[id] - Update a comment (author only)
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

    // Find the comment
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { authorId: true, status: true },
    });

    if (!comment || comment.status !== 'active') {
      throw new NotFoundError('Comentariul');
    }

    // Check ownership
    if (comment.authorId !== user.id) {
      throw new AuthorizationError('Nu poți modifica acest comentariu');
    }

    // Parse and validate input
    const body = await request.json();
    const validatedData = updateCommentSchema.parse(body);

    // Sanitize content
    const sanitizedBody = sanitizeText(validatedData.body);

    if (sanitizedBody.length < 1) {
      throw new AuthorizationError('Comentariul este prea scurt după curățare');
    }

    // Update comment
    const updatedComment = await prisma.comment.update({
      where: { id },
      data: { body: sanitizedBody },
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
      id: updatedComment.id,
      body: updatedComment.body,
      updatedAt: updatedComment.updatedAt,
      author: {
        id: updatedComment.author.id,
        name: updatedComment.author.displayName || updatedComment.author.fullName,
        avatarUrl: updatedComment.author.avatarUrl,
      },
    });
  } catch (error) {
    console.error('PATCH /api/comments/[id] error:', error);
    return handleApiError(error);
  }
}

/**
 * DELETE /api/comments/[id] - Delete a comment (author or admin, soft delete)
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

    // Find the comment
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { authorId: true, status: true, postId: true },
    });

    if (!comment || comment.status !== 'active') {
      throw new NotFoundError('Comentariul');
    }

    // Check ownership (or admin)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (comment.authorId !== user.id && dbUser?.role !== 'admin') {
      throw new AuthorizationError('Nu poți șterge acest comentariu');
    }

    // Soft delete comment and decrement post comment count in transaction
    // Use updateMany with status condition to prevent race condition
    const [updatedComment] = await prisma.$transaction([
      prisma.comment.updateMany({
        where: {
          id,
          status: 'active', // Only update if still active (prevents double-decrement)
        },
        data: { status: 'deleted' },
      }),
      prisma.post.updateMany({
        where: {
          id: comment.postId,
          commentCount: { gt: 0 }, // Only decrement if count > 0 (prevents negative)
        },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);

    // If no rows were updated, comment was already deleted
    if (updatedComment.count === 0) {
      throw new NotFoundError('Comentariul a fost deja șters');
    }

    // Invalidate feed cache (commentCount changed)
    await invalidateFeedCache();

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/comments/[id] error:', error);
    return handleApiError(error);
  }
}
