import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { readRateLimit } from '@/lib/rate-limit';
import { RateLimitError } from '@/lib/errors';
import { redis } from '@/lib/redis/client';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    // Rate limiting
    if (readRateLimit) {
      const { success } = await readRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Prea multe cereri. Încearcă din nou mai târziu.');
      }
    }

    // Check cache first (30s TTL)
    const cacheKey = `unread:${user.id}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        return successResponse({ unreadCount: Number(cached) });
      }
    }

    // Count unread messages for this user
    const unreadCount = await prisma.directMessage.count({
      where: {
        recipientId: user.id,
        isRead: false,
      },
    });

    // Cache the result for 30 seconds
    if (redis) {
      await redis.set(cacheKey, unreadCount, { ex: 30 });
    }

    return successResponse({ unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}
