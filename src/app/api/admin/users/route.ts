import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { getAdminUser } from '@/lib/auth';
import { adminRateLimit } from '@/lib/rate-limit';
import { RateLimitError } from '@/lib/errors';

/**
 * GET /api/admin/users - Get users list (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAdminUser();

    // Check rate limit
    if (adminRateLimit) {
      const { success } = await adminRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Ai atins limita de cereri. Încearcă din nou mai târziu.');
      }
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');
    const query = searchParams.get('q');

    const users = await prisma.user.findMany({
      where: {
        ...(filter === 'banned' && { isBanned: true }),
        ...(filter === 'active' && { isBanned: false }),
        ...(query && {
          OR: [
            { fullName: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isBanned: true,
        bannedReason: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return successResponse({ users });
  } catch (error) {
    return handleApiError(error);
  }
}
