import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthenticationError, AuthorizationError, NotFoundError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin } from '@/lib/csrf';

/**
 * GET /api/posts/[id]/save - Check if post is saved by current user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Not authenticated - return not saved
      return successResponse({ saved: false });
    }

    // Check if saved
    const savedPost = await prisma.savedPost.findUnique({
      where: {
        userId_postId: {
          userId: user.id,
          postId,
        },
      },
    });

    return successResponse({ saved: !!savedPost });
  } catch (error) {
    return handleApiError(error);
  }
}

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
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
