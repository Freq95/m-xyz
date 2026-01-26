import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
} from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const MARKETPLACE_CATEGORIES = ['SELL', 'BUY', 'SERVICE'];

/**
 * PATCH /api/posts/[id]/sold - Mark a marketplace post as sold
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

    // Find the post
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        authorId: true,
        status: true,
        category: true,
      },
    });

    if (!post || post.status === 'deleted') {
      throw new NotFoundError('Postarea');
    }

    // Check ownership
    if (post.authorId !== user.id) {
      throw new AuthorizationError('Nu poți modifica această postare');
    }

    // Check if it's a marketplace post
    if (!MARKETPLACE_CATEGORIES.includes(post.category)) {
      throw new AuthorizationError('Această acțiune este disponibilă doar pentru anunțuri de tip Vând/Cumpăr/Servicii');
    }

    // Toggle sold status
    const newStatus = post.status === 'sold' ? 'active' : 'sold';

    const updatedPost = await prisma.post.update({
      where: { id },
      data: { status: newStatus },
      select: {
        id: true,
        status: true,
      },
    });

    return successResponse({
      id: updatedPost.id,
      status: updatedPost.status,
      isSold: updatedPost.status === 'sold',
    });
  } catch (error) {
    console.error('PATCH /api/posts/[id]/sold error:', error);
    return handleApiError(error);
  }
}
