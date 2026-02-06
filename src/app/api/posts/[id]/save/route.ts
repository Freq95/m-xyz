import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthorizationError, NotFoundError, RateLimitError } from '@/lib/errors';
import { getAuthUser } from '@/lib/auth';
import { validateOrigin } from '@/lib/csrf';
import { saveRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/posts/[id]/save - Save/bookmark a post
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    // Get authenticated user
    const user = await getAuthUser();

    // Check rate limit
    if (saveRateLimit) {
      const { success } = await saveRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Ai atins limita de salvări. Încearcă din nou mai târziu.');
      }
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });

    if (!post || post.status !== 'active') {
      throw new NotFoundError('Postarea');
    }

    // Check if already saved
    const existing = await prisma.savedPost.findUnique({
      where: {
        userId_postId: {
          userId: user.id,
          postId,
        },
      },
    });

    if (existing) {
      return successResponse({ saved: true, message: 'Postarea este deja salvată' });
    }

    // Save the post
    await prisma.savedPost.create({
      data: {
        userId: user.id,
        postId,
      },
    });

    return successResponse({ saved: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/posts/[id]/save - Remove post from saved
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    // Get authenticated user
    const user = await getAuthUser();

    // Check rate limit
    if (saveRateLimit) {
      const { success } = await saveRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Ai atins limita de salvări. Încearcă din nou mai târziu.');
      }
    }

    // Delete the saved post (if exists)
    await prisma.savedPost.deleteMany({
      where: {
        userId: user.id,
        postId,
      },
    });

    return successResponse({ saved: false });
  } catch (error) {
    return handleApiError(error);
  }
}
