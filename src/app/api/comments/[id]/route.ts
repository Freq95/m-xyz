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
    await prisma.$transaction([
      prisma.comment.update({
        where: { id },
        data: { status: 'deleted' },
      }),
      prisma.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('DELETE /api/comments/[id] error:', error);
    return handleApiError(error);
  }
}
