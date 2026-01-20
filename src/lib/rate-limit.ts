// Rate limiting is optional - requires @upstash/redis and @upstash/ratelimit packages
// If not installed, rate limiting is gracefully disabled (useful for development)

let Ratelimit: any = null;
let Redis: any = null;

try {
  // Try to import Upstash packages (they may not be installed)
  const ratelimitModule = require('@upstash/ratelimit');
  const redisModule = require('@upstash/redis');
  Ratelimit = ratelimitModule.Ratelimit;
  Redis = redisModule.Redis;
} catch (error) {
  // Packages not installed - rate limiting will be disabled
  console.warn('⚠️  Upstash packages not installed. Rate limiting is disabled. Install @upstash/redis and @upstash/ratelimit for production.');
}

// Create Redis client
const redis = Ratelimit && Redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Auth rate limiter: 5 requests per 15 minutes
export const authRateLimit = redis && Ratelimit
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      analytics: true,
      prefix: 'ratelimit:auth',
    })
  : null;

// Post rate limiter: 10 posts per hour
export const postRateLimit = redis && Ratelimit
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      analytics: true,
      prefix: 'ratelimit:post',
    })
  : null;

// Comment rate limiter: 30 comments per hour
export const commentRateLimit = redis && Ratelimit
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 h'),
      analytics: true,
      prefix: 'ratelimit:comment',
    })
  : null;

// General API rate limiter: 100 requests per minute
export const apiRateLimit = redis && Ratelimit
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'ratelimit:api',
    })
  : null;

/**
 * Get client IP address from request
 */
export function getClientIp(request: Request): string {
  // Check various headers for IP address (in order of preference)
  const headers = request.headers;

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a default (shouldn't happen in production)
  return 'unknown';
}
