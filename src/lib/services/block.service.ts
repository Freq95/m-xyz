import prisma from '@/lib/prisma/client';
import { redis } from '@/lib/redis/client';

/**
 * Cache TTL for blocked user lists (5 minutes)
 * Balance between freshness and performance
 */
const BLOCK_CACHE_TTL = 300; // 5 minutes

/**
 * Get cache key for a user's blocked list
 */
function getBlockCacheKey(userId: string): string {
  return `blocked:${userId}`;
}

/**
 * Get list of user IDs that the specified user has blocked
 * Results are cached in Redis for 5 minutes
 *
 * @param userId - The user ID to get blocked users for
 * @returns Array of blocked user IDs
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const cacheKey = getBlockCacheKey(userId);

  // Try cache first
  if (redis) {
    try {
      const cached = await redis.get<string[]>(cacheKey);
      if (cached) {
        return Array.isArray(cached) ? cached : [];
      }
    } catch (error) {
      console.error('Redis cache read error:', error);
      // Continue to database query if cache fails
    }
  }

  // Fetch from database
  const blockedUsers = await prisma.blockedUser.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });

  const blockedIds = blockedUsers.map(b => b.blockedId);

  // Store in cache
  if (redis) {
    try {
      await redis.set(cacheKey, blockedIds, { ex: BLOCK_CACHE_TTL });
    } catch (error) {
      console.error('Redis cache write error:', error);
      // Non-blocking: continue even if cache write fails
    }
  }

  return blockedIds;
}

/**
 * Check if there's a block relationship between two users (either direction)
 *
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 * @returns true if either user has blocked the other
 */
export async function isUserBlocked(userId1: string, userId2: string): Promise<boolean> {
  // Check cache for both directions
  if (redis) {
    try {
      const [blocked1, blocked2] = await Promise.all([
        getBlockedUserIds(userId1),
        getBlockedUserIds(userId2),
      ]);

      return blocked1.includes(userId2) || blocked2.includes(userId1);
    } catch (error) {
      console.error('Block check error:', error);
      // Fall through to database query
    }
  }

  // Database query as fallback
  const block = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    },
  });

  return !!block;
}

/**
 * Check if user1 has blocked user2 (one-way check)
 *
 * @param blockerId - The user who may have blocked
 * @param blockedId - The user who may be blocked
 * @returns true if blockerId has blocked blockedId
 */
export async function hasBlockedUser(blockerId: string, blockedId: string): Promise<boolean> {
  const blockedIds = await getBlockedUserIds(blockerId);
  return blockedIds.includes(blockedId);
}

/**
 * Get list of users blocked by OR who have blocked the specified user (both directions)
 * Used for filtering conversations where either party blocked the other
 *
 * @param userId - The user ID to get bidirectional blocks for
 * @returns Set of user IDs with block relationship in either direction
 */
export async function getBidirectionalBlockedUserIds(userId: string): Promise<Set<string>> {
  const [blockedByMe, blockedMe] = await Promise.all([
    prisma.blockedUser.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    }),
    prisma.blockedUser.findMany({
      where: { blockedId: userId },
      select: { blockerId: true },
    }),
  ]);

  const blocked = new Set<string>();
  blockedByMe.forEach(b => blocked.add(b.blockedId));
  blockedMe.forEach(b => blocked.add(b.blockerId));

  return blocked;
}

/**
 * Invalidate block cache for a user
 * Call this after blocking/unblocking to ensure fresh data
 *
 * @param userId - The user ID whose cache should be invalidated
 */
export async function invalidateBlockCache(userId: string): Promise<void> {
  if (!redis) return;

  const cacheKey = getBlockCacheKey(userId);

  try {
    await redis.del(cacheKey);
  } catch (error) {
    console.error('Redis cache invalidation error:', error);
    // Non-blocking: log error but don't throw
  }
}

/**
 * Invalidate block cache for both users in a block/unblock operation
 *
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 */
export async function invalidateBlockCacheForBoth(userId1: string, userId2: string): Promise<void> {
  await Promise.all([
    invalidateBlockCache(userId1),
    invalidateBlockCache(userId2),
  ]);
}
