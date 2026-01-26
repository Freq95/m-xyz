import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError } from '@/lib/errors';

/**
 * GET /api/users/[id] - Get public user profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        displayName: true,
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

    return successResponse({
      id: user.id,
      name: user.displayName || user.fullName,
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
