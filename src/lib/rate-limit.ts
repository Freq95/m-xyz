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

// Save/bookmark rate limiter: 60 saves per hour
export const saveRateLimit = redis && Ratelimit
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 h'),
      analytics: true,
      prefix: 'ratelimit:save',
    })
  : null;

// Admin actions rate limiter: 100 requests per minute
export const adminRateLimit = redis && Ratelimit
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'ratelimit:admin',
    })
  : null;

// Search rate limiter: 30 searches per minute
export const searchRateLimit = redis && Ratelimit
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: 'ratelimit:search',
    })
  : null;

// Message rate limiter: 100 messages per hour
export const messageRateLimit = redis && Ratelimit
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 h'),
      analytics: true,
      prefix: 'ratelimit:message',
    })
  : null;

// Read operations rate limiter: 300 reads per minute
export const readRateLimit = redis && Ratelimit
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(300, '1 m'),
      analytics: true,
      prefix: 'ratelimit:read',
    })
  : null;

/**
 * Get client IP address from request
 *
 * IMPORTANT: This implementation assumes you're behind a trusted reverse proxy
 * (Vercel, Cloudflare, etc.) that sets x-forwarded-for correctly.
 *
 * For additional security, you should:
 * 1. Configure your reverse proxy to strip/overwrite x-forwarded-for from clients
 * 2. Use Vercel's ip() function if deployed on Vercel
 * 3. Validate IP format to prevent injection
 */
export function getClientIp(request: Request): string {
  // Check various headers for IP address (in order of preference)
  const headers = request.headers;

  // x-forwarded-for format: "client, proxy1, proxy2"
  // Take the first IP (client) but validate it
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const clientIp = forwarded.split(',')[0].trim();

    // Basic validation: IP should match IPv4 or IPv6 format
    // IPv4: xxx.xxx.xxx.xxx
    // IPv6: xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    if (ipv4Regex.test(clientIp) || ipv6Regex.test(clientIp)) {
      return clientIp;
    }

    // Invalid IP format - possible spoofing attempt
    console.warn(`Invalid IP format in x-forwarded-for: ${clientIp}`);
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a default (shouldn't happen in production)
  // Using 'unknown' ensures rate limiting still works (all unknown IPs share same limit)
  return 'unknown';
}
