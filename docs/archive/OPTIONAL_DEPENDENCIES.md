# Optional Dependencies

The Vecinu app has been designed to work with **graceful degradation** for certain features. This allows you to develop and test the app without setting up external services immediately.

## Rate Limiting (Upstash Redis)

**Packages:**
- `@upstash/redis`
- `@upstash/ratelimit`

**Status:** Optional for development, **required for production**

**What happens without it:**
- Rate limiting is **disabled**
- You'll see a warning in console: "⚠️  Upstash packages not installed. Rate limiting is disabled."
- Auth endpoints work but are **vulnerable to brute force attacks**
- App functions normally otherwise

**To enable:**
1. Sign up for free Upstash account: https://upstash.com
2. Create a Redis database (free tier: 10,000 commands/day)
3. Get REST URL and token from dashboard
4. Add to `.env.local`:
   ```env
   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```
5. Install packages:
   ```bash
   npm install
   ```
6. Restart dev server - rate limiting now active

**Rate limits when enabled:**
- Auth endpoints: 5 requests per 15 minutes
- Post creation: 10 posts per hour
- Comments: 30 per hour
- General API: 100 per minute

---

## Email Service (Resend)

**Package:** `resend`

**Status:** Optional - Supabase handles email verification

**What happens without it:**
- Email verification still works (Supabase sends emails)
- Custom email features won't work (future: password reset emails, notifications, etc.)

**To enable (future use):**
1. Sign up for free Resend account: https://resend.com
2. Get API key (free tier: 3,000 emails/month)
3. Add to `.env.local`:
   ```env
   RESEND_API_KEY=re_your-api-key
   EMAIL_FROM=noreply@vecinu.ro
   ```
4. Install package:
   ```bash
   npm install
   ```

---

## Installation

These packages are listed as `optionalDependencies` in `package.json`:

```bash
# Install all dependencies including optional ones
npm install

# Or install specific optional packages
npm install @upstash/redis @upstash/ratelimit resend
```

**If installation fails**, the app will still work - optional features will be disabled.

---

## Development vs Production

### Development (Current Setup)
- ✅ Works without optional dependencies
- ⚠️ No rate limiting (not a problem for local testing)
- ✅ Supabase handles email verification
- ✅ Can test all auth flows

### Production (Required)
- ❌ Must install Upstash Redis for rate limiting
- ✅ Supabase handles emails (Resend still optional)
- ⚠️ Without rate limiting, vulnerable to attacks

---

## Quick Start (Development)

**Minimum requirements to run the app:**

1. Copy `.env.example` to `.env.local`
2. Fill in Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   DATABASE_URL=postgresql://...
   ```
3. Run:
   ```bash
   npm install          # Installs required deps, skips optional if they fail
   npm run db:push      # Apply database schema
   npm run dev          # Start dev server
   ```

That's it! The app works without Upstash or Resend.

---

## Before Production Deployment

**Required setup:**
1. ✅ Set up Upstash Redis (rate limiting)
2. ✅ Configure Supabase email templates
3. ⚠️ Optional: Set up Resend (for custom emails later)
4. ✅ Set all environment variables in Vercel

**Security checklist:**
- [ ] Rate limiting enabled and tested
- [ ] Email verification working
- [ ] Environment variables secured
- [ ] HTTPS enforced (automatic on Vercel)

---

**Last Updated:** 2026-01-18
**Tested Configuration:** Works without optional dependencies
