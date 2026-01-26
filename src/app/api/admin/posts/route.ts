import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { getAdminUser } from '@/lib/auth';

/**
 * GET /api/admin/posts - Get posts list (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await getAdminUser();

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');
    const query = searchParams.get('q');

    const posts = await prisma.post.findMany({
      where: {
        ...(filter === 'hidden' && { status: 'hidden' }),
        ...(filter === 'active' && { status: { not: 'hidden' } }),
        ...(query && {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { body: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        status: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return successResponse({ posts });
  } catch (error) {
    return handleApiError(error);
  }
}
