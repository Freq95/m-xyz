import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { isUserBlocked } from '@/lib/services/block.service';

/**
 * GET /api/users/[id] - Get public user profile by ID or username
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if id is a UUID (old format) or username (new format)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const user = await prisma.user.findFirst({
      where: isUUID ? { id } : { username: id },
      select: {
        id: true,
        fullName: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        neighborhood: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            posts: {
              where: { status: 'active' },
            },
            comments: {
              where: { status: 'active' },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('Utilizatorul');
    }

    // Check if there's a block relationship between current user and profile user
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (currentUser && currentUser.id !== user.id) {
      const blocked = await isUserBlocked(currentUser.id, user.id);
      if (blocked) {
        throw new NotFoundError('Utilizatorul');
      }
    }

    return successResponse({
      id: user.id,
      name: user.displayName || user.fullName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      joinedAt: user.createdAt,
      neighborhood: user.neighborhood
        ? {
            id: user.neighborhood.id,
            name: user.neighborhood.name,
            slug: user.neighborhood.slug,
          }
        : null,
      stats: {
        postCount: user._count.posts,
        commentCount: user._count.comments,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
