# GPT Performance Proposal — 10k Concurrent Readiness

**Scope:** Make Vecinu performant and scalable for ~10k concurrent users across the entire platform (feed, search, messaging, notifications, profiles, admin).  
**Assumptions:** Supabase Postgres + Upstash Redis + Next.js App Router.  
**Primary Targets:**
- p95 feed data response < 250ms
- p95 read API endpoints < 150ms
- cache hit rate for hot feeds/search > 80%
- DB QPS under peak < 500/s
- messaging latency < 2s for new messages

---

## Phase 0 — Baseline & Observability (1–2 days)
**Goal:** Get real measurements before changing behavior.

**Tasks (codebase mapping):**
- Add a small timing helper in `src/lib/metrics.ts` (new file) to measure request duration and attach `X-Response-Time` header.
- Instrument hot API routes with `withTiming`:
  - `src/app/api/posts/route.ts`
  - `src/app/api/search/route.ts`
  - `src/app/api/comments/route.ts`
  - `src/app/api/notifications/route.ts`
  - `src/app/api/conversations/route.ts`
  - `src/app/api/messages/route.ts`
  - `src/app/api/posts/saved/route.ts`
  - `src/app/api/users/[id]/posts/route.ts`
- Add cache hit/miss counters in `src/lib/redis/client.ts` (simple console logging or structured log tag).

**Checkpoint:**
- Baseline report with p95 times and QPS for feed/search/messaging.

---

## Phase 1 — Read Path Optimization (Feed, Search, Lists)
**Goal:** Fast category switching and low DB load for the most common reads.

**Tasks (codebase mapping):**
- **Client-side category switching**
  - Update `src/components/feed/feed-client.tsx` to fetch `/api/posts` directly on tab change instead of `router.push` server nav.
  - Update URL via `router.replace` without full page reload.
- **Move to denormalized counts**
  - Use `commentCount` from `Post` instead of `_count` in:
    - `src/app/(main)/feed/page.tsx`
    - `src/app/api/posts/route.ts`
    - `src/app/api/search/route.ts`
    - `src/app/api/users/[id]/posts/route.ts`
    - `src/app/api/posts/saved/route.ts`
  - Ensure all comment status transitions update `commentCount` (see Phase 4).
- **User-specific overlay**
  - Add batch likes endpoint: `src/app/api/posts/likes/batch/route.ts` (new) similar to saved batch.
  - Add block list endpoint: `src/app/api/user/blocks/route.ts` (new) to return blocked IDs.
  - Update `src/components/feed/feed-client.tsx` to call:
    - `/api/posts` for base list
    - `/api/posts/likes/batch` for liked state
    - `/api/posts/saved/batch` for saved state
    - `/api/user/blocks` to filter blocked authors client-side
- **Trim response payloads**
  - Replace `include` with `select` where full relations aren’t needed in:
    - `src/app/api/posts/route.ts`
    - `src/app/api/search/route.ts`

**Checkpoint:**
- Category switches under 300ms on warm cache.
- p95 feed API < 150ms.

---

## Phase 2 — Messaging at Scale
**Goal:** Reduce polling overhead and DB load for chat.

**Tasks (codebase mapping):**
- Add visibility-aware polling (pause when tab hidden) in:
  - `src/app/(main)/messages/[id]/page.tsx`
  - `src/components/messages/conversations-list.tsx`
  - `src/components/layout/message-badge.tsx`
- Add idle backoff: poll at 5s when active, 30–60s when idle.
- Optional realtime (recommended for 10k concurrent):
  - Use Supabase Realtime channels for new messages.
  - Keep polling as fallback.

**Checkpoint:**
- Messaging DB reads reduced by >70% compared to baseline.

---

## Phase 3 — Notifications
**Goal:** Keep notifications cheap and responsive.

**Tasks (codebase mapping):**
- Cache unread count for notifications (similar to messages):
  - `src/app/api/notifications/route.ts`
  - `src/lib/services/notification.service.ts`
- Batch updates when marking read:
  - `src/app/api/notifications/[id]/read/route.ts`
  - `src/app/api/notifications/read-all/route.ts`
- If email settings are visible, integrate Resend or relabel UI:
  - `src/app/(main)/settings/page.tsx`
  - `src/lib/services/notification.service.ts`

**Checkpoint:**
- Notifications traffic < 5% of DB QPS at peak.

---

## Phase 4 — Data Integrity + Index Tuning
**Goal:** Ensure denormalized data stays correct and queries stay indexed.

**Tasks (codebase mapping):**
- Update all comment status transitions to adjust `commentCount`:
  - `src/app/api/comments/route.ts`
  - `src/app/api/comments/[id]/route.ts`
  - `src/lib/services/admin.service.ts` (hide/unhide comment)
- Add indexes only if `EXPLAIN ANALYZE` shows slow queries:
  - Candidate index: `(neighborhoodId, status, category, isPinned, createdAt DESC)`
  - Update `prisma/schema.prisma` and run migration.

**Checkpoint:**
- No slow queries > 300ms in hot endpoints.

---

## Phase 5 — Caching & Edge Strategy
**Goal:** Serve hot reads from cache/CDN with safe freshness.

**Tasks (codebase mapping):**
- Add `Cache-Control` for anonymous GETs:
  - `src/app/api/posts/route.ts`
  - `src/app/api/search/route.ts`
  - Use `s-maxage=30, stale-while-revalidate=60`.
- Ensure cache invalidation on write paths:
  - `src/lib/redis/client.ts` (already used by posts)
  - Add invalidation on likes/saves if displayed in cached views.

**Checkpoint:**
- Cache hit rate > 80% on feed/search first page.

---

## Phase 6 — Media & Payload Optimization
**Goal:** Reduce bandwidth and improve LCP.

**Tasks (codebase mapping):**
- Use thumbnail URLs in list views and correct `sizes`:
  - `src/components/feed/post-card.tsx`
- Ensure detail pages use optimized images:
  - `src/app/(main)/post/[id]/page.tsx`

**Checkpoint:**
- LCP < 2.5s on mobile for feed.

---

## Phase 7 — Auth & Abuse Controls
**Goal:** Prevent abusive traffic from spiking DB load.

**Tasks (codebase mapping):**
- Standardize ban checks using `getAuthUser()` across write endpoints:
  - `src/app/api/posts/[id]/like/route.ts`
  - `src/app/api/posts/[id]/save/route.ts`
  - `src/app/api/reports/route.ts`
- Add rate limit to reports:
  - `src/app/api/reports/route.ts`

**Checkpoint:**
- Abuse endpoints capped at safe QPS.

---

## Phase 8 — Infra & Configuration
**Goal:** Avoid connection limits and resource exhaustion.

**Tasks (ops):**
- Enable Supabase connection pooling.
- Upgrade Supabase compute tier if p95 > target.
- Use Upstash Redis with sufficient commands/day.

**Checkpoint:**
- No connection saturation during load testing.

---

## Phase 9 — Load Testing & Validation
**Goal:** Validate 10k concurrent readiness.

**Tasks (codebase mapping):**
- Add load test scripts:
  - `scripts/load/k6-feed.js` (new)
  - `scripts/load/k6-messages.js` (new)
- Test scenarios:
  - Feed browse + category switch
  - Search
  - Messaging read/write

**Checkpoint:**
- Targets met for p95 and DB QPS under simulated peak.

---

## Suggested Order of Implementation
1. Phase 0 (measurement)
2. Phase 1 (feed/search/list optimizations)
3. Phase 2 (messaging load reduction)
4. Phase 5 (caching)
5. Phase 4 (data integrity + indexes)
6. Phase 7 (abuse controls)
7. Phase 6 (media)
8. Phase 9 (load testing)
9. Phase 8 (infra tuning)

---

## Deliverable Definition for “10k Concurrent Ready”
- Feed and search consistently under 250ms p95
- Messaging under 2s end-to-end
- DB QPS under 500/s at peak
- Cache hit rate > 80% on hot reads
- No sustained DB CPU > 70%
