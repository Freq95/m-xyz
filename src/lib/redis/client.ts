import { Redis } from '@upstash/redis';

// Create Redis client (only if credentials are provided)
export const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Helper to check if Redis is enabled
export const isRedisEnabled = () => redis !== null;

// Cache keys
export const CACHE_KEYS = {
  FEED: (params: { categorySlug?: string; filterSlug?: string; neighborhoodSlug?: string }) => {
    const parts = ['feed'];
    if (params.categorySlug) parts.push(`cat:${params.categorySlug}`);
    if (params.filterSlug) parts.push(`filter:${params.filterSlug}`);
    if (params.neighborhoodSlug) parts.push(`nbh:${params.neighborhoodSlug}`);
    return parts.join(':');
  },
  POST: (id: string) => `post:${id}`,
} as const;

// Cache TTLs (in seconds)
export const CACHE_TTL = {
  FEED: 900, // 15 minutes
  POST: 600, // 10 minutes
} as const;

// Helper to invalidate feed cache
export async function invalidateFeedCache() {
  if (!redis) return;

  try {
    // Use SCAN instead of KEYS to avoid blocking the server
    const allKeys: string[] = [];
    let cursor = 0;
    let iterations = 0;
    const MAX_ITERATIONS = 1000; // Safety limit to prevent infinite loops

    do {
      // Safety check: prevent infinite loops
      if (iterations++ > MAX_ITERATIONS) {
        console.error(`Redis SCAN exceeded max iterations (${MAX_ITERATIONS}). Stopping to prevent blocking.`);
        break;
      }

      const result = await redis.scan(cursor, {
        match: 'feed:*',
        count: 100,
      });
      cursor = typeof result[0] === 'string' ? parseInt(result[0], 10) : result[0];
      allKeys.push(...result[1]);
    } while (cursor !== 0);

    if (allKeys.length > 0) {
      // Delete keys in batches to avoid command size limits
      const BATCH_SIZE = 100;
      for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
        const batch = allKeys.slice(i, i + BATCH_SIZE);
        await redis.del(...batch);
      }
    }
  } catch (error) {
    console.error('Failed to invalidate feed cache:', error);
  }
}

// Helper to invalidate post cache
export async function invalidatePostCache(postId: string) {
  if (!redis) return;

  try {
    await redis.del(CACHE_KEYS.POST(postId));
  } catch (error) {
    console.error('Failed to invalidate post cache:', error);
  }
}
