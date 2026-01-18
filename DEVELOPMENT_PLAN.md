# Vecinu - Development Plan

## Executive Summary

Building **Vecinu** - a hyper-local neighborhood social network for Romania (similar to Nextdoor). The app connects neighbors for local alerts, marketplace, services, and community discussions.

- **Pilot Location:** Timișoara
- **Language:** Romanian (with latin-ext font support for diacritics)
- **Target:** Solo developer, scalable architecture
- **Timeline:** 16-18 weeks to pilot launch (realistic estimate)
- **Plan Version:** 2.0 (Updated with deep dive review findings)

---

## Part 1: Analysis of Original GPT Plan

### What Was Good
1. Clear market gap identified - no active Nextdoor-like app in Romania
2. Realistic MVP scope - web-first, single neighborhood pilot
3. Solid database schema foundation (10 tables)
4. Practical monetization models (local ads, promoted posts)
5. "Light one neighborhood at a time" go-to-market strategy

### Issues I Identified & Fixed

| Original GPT Plan | Problem | My Improvement |
|-------------------|---------|----------------|
| NestJS + Redis + ElasticSearch | Overengineered for solo dev MVP | Next.js monolith - single codebase |
| Separate frontend/backend | Extra deployment complexity | Full-stack Next.js with API routes |
| No email verification | Opens door to spam/fake accounts | Email verification required |
| Weak address verification | Just "select from list" | Phone verification option added |
| No GDPR/privacy mention | Legal risk in EU | Privacy policy, data deletion flows |
| No analytics planned | Can't measure success | Plausible/PostHog from day 1 |
| Business features in weeks 9-10 | Too early, not validated | Moved to post-pilot phase |
| 20-80K EUR cost estimate | Unrealistic for validation | 0-10 EUR/month with free tiers |
| No rate limiting | DoS/spam vulnerability | Upstash rate limiting |
| No security considerations | XSS, injection risks | Prisma (parameterized), sanitization |

---

## Part 2: Tech Stack

### Recommended Stack (Optimized for Solo Dev + Future Scale)

| Layer | Technology | Why This Choice |
|-------|------------|-----------------|
| **Framework** | Next.js 14+ (App Router) | Full-stack React, SSR for SEO, single codebase, fast iteration |
| **Language** | TypeScript | Type safety, better DX, fewer runtime errors |
| **Styling** | Tailwind CSS + shadcn/ui | No designer needed, accessible, mobile-first components |
| **Database** | PostgreSQL (via Supabase) | Free tier generous, real-time subscriptions, auth included |
| **ORM** | Prisma | Type-safe queries, excellent migrations, works great with Supabase |
| **Auth** | Supabase Auth | Free, handles email/password, OAuth-ready, magic links |
| **File Storage** | Supabase Storage | S3-compatible, integrated with auth, generous free tier |
| **Email** | Resend | 3,000 free emails/month, simple API, great deliverability |
| **Background Jobs** | Inngest | Serverless-friendly, free tier (5K events/month) |
| **Caching** | Upstash Redis | Serverless Redis, 10K commands/day free |
| **Hosting** | Vercel (frontend) + Supabase (backend) | Zero DevOps, automatic scaling, global CDN |
| **CDN** | Cloudflare | Free tier, unlimited bandwidth, DDoS protection |
| **Analytics** | Plausible or PostHog | Privacy-friendly, GDPR compliant |

### Why NOT the Original Stack (NestJS + Redis + ElasticSearch)?

1. **NestJS** - Great framework, but requires separate deployment, adds complexity for MVP
2. **Redis from day 1** - Premature optimization, Supabase handles caching adequately for MVP
3. **ElasticSearch** - Overkill until 50K+ posts, PostgreSQL full-text search is sufficient
4. **React Native** - Native apps can wait until web MVP is validated

### Cost Analysis

| Phase | Users | Monthly Cost |
|-------|-------|--------------|
| **MVP** | 0-500 | **0-10 EUR** (all free tiers) |
| **Growth** | 500-10K | **~110 EUR** |
| **Scale** | 10K-100K | **~500-1000 EUR** |
| **Large** | 100K-1M | **2000-5000 EUR** |

**Free Tier Breakdown:**
- Vercel: 100GB bandwidth, 100 hours compute
- Supabase: 500MB database, 1GB storage, 2GB bandwidth
- Resend: 3,000 emails/month
- Upstash Redis: 10K commands/day
- Inngest: 5,000 events/month
- Cloudflare: Unlimited bandwidth

---

## Part 3: Database Schema

### Core Tables (MVP)

```sql
-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authentication
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified_at TIMESTAMPTZ,
  password_hash VARCHAR(255),           -- Null if using magic link/OAuth

  -- Profile
  full_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(50),             -- Optional nickname
  avatar_url TEXT,
  bio TEXT,

  -- Location
  neighborhood_id UUID REFERENCES neighborhoods(id),
  address_verified BOOLEAN DEFAULT FALSE,

  -- Permissions
  role VARCHAR(20) DEFAULT 'user',      -- user, moderator, admin, business
  is_banned BOOLEAN DEFAULT FALSE,
  banned_at TIMESTAMPTZ,
  banned_reason TEXT,

  -- Engagement tracking
  last_active_at TIMESTAMPTZ,

  -- Settings
  notification_preferences JSONB DEFAULT '{
    "email_comments": true,
    "email_alerts": true,
    "email_digest": "daily",
    "push_enabled": true
  }',
  language VARCHAR(5) DEFAULT 'ro',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_neighborhood ON users(neighborhood_id) WHERE is_banned = FALSE;


-- ============================================
-- NEIGHBORHOODS TABLE
-- ============================================
CREATE TABLE neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name VARCHAR(100) NOT NULL,           -- "Fabric", "Complexul Studențesc"
  city VARCHAR(100) NOT NULL,           -- "Timișoara"
  slug VARCHAR(100) UNIQUE NOT NULL,    -- "fabric", "complex-studentesc"
  description TEXT,

  -- Stats (denormalized for performance)
  member_count INT DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT FALSE,      -- Launch control

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_neighborhoods_city ON neighborhoods(city) WHERE is_active = TRUE;
CREATE INDEX idx_neighborhoods_slug ON neighborhoods(slug);


-- ============================================
-- POSTS TABLE
-- ============================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
  author_id UUID NOT NULL REFERENCES users(id),

  -- Content
  title VARCHAR(200),
  body TEXT NOT NULL,
  category VARCHAR(30) NOT NULL,        -- ALERT, SELL, BUY, SERVICE, QUESTION, EVENT, LOST_FOUND

  -- Marketplace-specific
  price_cents INT,                      -- Price in bani (Romanian cents)
  currency CHAR(3) DEFAULT 'RON',
  is_free BOOLEAN DEFAULT FALSE,

  -- Status
  status VARCHAR(20) DEFAULT 'active',  -- active, hidden, deleted, sold, resolved
  is_pinned BOOLEAN DEFAULT FALSE,
  pinned_until TIMESTAMPTZ,

  -- Engagement (denormalized for feed performance)
  comment_count INT DEFAULT 0,
  view_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ                -- Auto-expire marketplace posts (30 days)
);

-- Critical indexes for feed performance
CREATE INDEX idx_posts_feed ON posts(neighborhood_id, created_at DESC)
  WHERE status = 'active';
CREATE INDEX idx_posts_category ON posts(neighborhood_id, category, created_at DESC)
  WHERE status = 'active';
CREATE INDEX idx_posts_author ON posts(author_id, created_at DESC);
CREATE INDEX idx_posts_pinned ON posts(neighborhood_id, pinned_until)
  WHERE is_pinned = TRUE AND status = 'active';


-- ============================================
-- POST IMAGES TABLE
-- ============================================
CREATE TABLE post_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

  -- Image data
  url TEXT NOT NULL,                    -- Original image URL
  thumbnail_url TEXT,                   -- Optimized thumbnail
  width INT,
  height INT,
  size_bytes INT,
  position SMALLINT DEFAULT 0,          -- Order in gallery (0, 1, 2, 3)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_post_images_post ON post_images(post_id);


-- ============================================
-- COMMENTS TABLE (Threaded)
-- ============================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,  -- For threading

  -- Content
  body TEXT NOT NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'active',  -- active, hidden, deleted

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON comments(post_id, created_at ASC)
  WHERE status = 'active';
CREATE INDEX idx_comments_parent ON comments(parent_id)
  WHERE parent_id IS NOT NULL;


-- ============================================
-- REPORTS TABLE (Moderation)
-- ============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reporter
  reporter_id UUID NOT NULL REFERENCES users(id),

  -- Target (polymorphic)
  target_type VARCHAR(20) NOT NULL,     -- POST, COMMENT, USER
  target_id UUID NOT NULL,

  -- Report details
  reason VARCHAR(50) NOT NULL,          -- spam, harassment, scam, inappropriate, dangerous, other
  details TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, reviewed, actioned, dismissed

  -- Admin action
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  action_taken VARCHAR(50),             -- warning, hide, delete, ban, none

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);


-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Notification content
  type VARCHAR(50) NOT NULL,            -- new_comment, new_reply, post_alert, etc.
  title VARCHAR(200) NOT NULL,
  body TEXT,
  data JSONB,                           -- { post_id, comment_id, etc. }

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read)
  WHERE is_read = FALSE;
```

### Post-MVP Tables (Add When Needed)

```sql
-- ============================================
-- BUSINESS PROFILES (Phase 6: Monetization)
-- ============================================
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,        -- RESTAURANT, SERVICE, RETAIL, etc.
  description TEXT,
  address TEXT,
  phone VARCHAR(20),
  website VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SPONSORED POSTS (Phase 6: Monetization)
-- ============================================
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  budget_lei DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, expired, cancelled
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Part 4: API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout (invalidate session) |
| POST | `/api/auth/verify-email` | Verify email with token |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| GET | `/api/auth/me` | Get current user profile |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get detailed profile |
| PATCH | `/api/users/me` | Update profile (name, bio, avatar) |
| POST | `/api/users/me/neighborhood` | Join/change neighborhood |
| DELETE | `/api/users/me` | Delete account (GDPR) |

### Neighborhoods
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/neighborhoods` | List active neighborhoods |
| GET | `/api/neighborhoods/:slug` | Get neighborhood details |

### Posts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | Feed (paginated, filterable) |
| POST | `/api/posts` | Create new post |
| GET | `/api/posts/:id` | Get single post with comments |
| PATCH | `/api/posts/:id` | Edit post (author only) |
| DELETE | `/api/posts/:id` | Delete post (author/admin) |
| POST | `/api/posts/:id/view` | Increment view count |

**Query Parameters for GET /api/posts:**
- `neighborhood` (required): neighborhood slug
- `category` (optional): ALERT, SELL, BUY, SERVICE, QUESTION, EVENT
- `cursor` (optional): pagination cursor (post ID)
- `limit` (optional): items per page (default: 20, max: 50)

### Comments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts/:id/comments` | List comments for post |
| POST | `/api/posts/:id/comments` | Add comment |
| PATCH | `/api/comments/:id` | Edit comment (author only) |
| DELETE | `/api/comments/:id` | Delete comment (author/admin) |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reports` | Report content |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List user notifications |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| POST | `/api/notifications/read-all` | Mark all as read |

### Admin (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/reports` | List pending reports |
| PATCH | `/api/admin/reports/:id` | Handle report (action) |
| PATCH | `/api/admin/posts/:id` | Change post status |
| PATCH | `/api/admin/comments/:id` | Change comment status |
| PATCH | `/api/admin/users/:id/ban` | Ban/unban user |
| GET | `/api/admin/stats` | Dashboard statistics |

---

## Part 5: Project Structure

```
vecinu/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Auth route group (no layout)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── verify-email/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── layout.tsx                # Auth-specific layout
│   │
│   ├── (main)/                       # Authenticated routes
│   │   ├── feed/
│   │   │   └── page.tsx              # Main feed
│   │   ├── post/
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx          # Post detail
│   │   │   └── new/
│   │   │       └── page.tsx          # Create post
│   │   ├── profile/
│   │   │   └── page.tsx              # User profile
│   │   ├── settings/
│   │   │   └── page.tsx              # User settings
│   │   ├── notifications/
│   │   │   └── page.tsx              # Notifications list
│   │   └── layout.tsx                # Main app layout (with nav)
│   │
│   ├── admin/                        # Admin routes
│   │   ├── reports/
│   │   │   └── page.tsx
│   │   ├── users/
│   │   │   └── page.tsx
│   │   └── layout.tsx                # Admin layout
│   │
│   ├── api/                          # API routes
│   │   ├── auth/
│   │   │   ├── register/route.ts
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   ├── verify-email/route.ts
│   │   │   └── me/route.ts
│   │   ├── posts/
│   │   │   ├── route.ts              # GET (list), POST (create)
│   │   │   └── [id]/
│   │   │       ├── route.ts          # GET, PATCH, DELETE
│   │   │       └── comments/
│   │   │           └── route.ts      # GET, POST
│   │   ├── comments/
│   │   │   └── [id]/route.ts         # PATCH, DELETE
│   │   ├── reports/
│   │   │   └── route.ts              # POST
│   │   ├── notifications/
│   │   │   └── route.ts              # GET
│   │   ├── neighborhoods/
│   │   │   └── route.ts              # GET
│   │   ├── admin/
│   │   │   ├── reports/route.ts
│   │   │   ├── posts/[id]/route.ts
│   │   │   └── users/[id]/route.ts
│   │   └── inngest/
│   │       └── route.ts              # Inngest webhook
│   │
│   ├── globals.css                   # Global styles
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Landing page
│
├── components/
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── avatar.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── dialog.tsx
│   │   ├── toast.tsx
│   │   ├── tabs.tsx
│   │   ├── badge.tsx
│   │   └── skeleton.tsx
│   │
│   ├── feed/                         # Feed-related components
│   │   ├── post-card.tsx
│   │   ├── post-list.tsx
│   │   ├── post-form.tsx
│   │   ├── category-filter.tsx
│   │   └── post-image-gallery.tsx
│   │
│   ├── comments/                     # Comment components
│   │   ├── comment-list.tsx
│   │   ├── comment-item.tsx
│   │   └── comment-form.tsx
│   │
│   ├── layout/                       # Layout components
│   │   ├── app-shell.tsx
│   │   ├── header.tsx
│   │   ├── mobile-bottom-nav.tsx
│   │   ├── desktop-sidebar.tsx
│   │   └── notification-bell.tsx
│   │
│   └── shared/                       # Shared components
│       ├── user-avatar.tsx
│       ├── loading-spinner.tsx
│       ├── empty-state.tsx
│       ├── error-boundary.tsx
│       └── optimized-image.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # Server client
│   │   └── middleware.ts             # Auth middleware helper
│   │
│   ├── prisma/
│   │   └── client.ts                 # Prisma client singleton
│   │
│   ├── services/                     # Business logic (extractable)
│   │   ├── feed.service.ts
│   │   ├── post.service.ts
│   │   ├── comment.service.ts
│   │   ├── notification.service.ts
│   │   ├── image.service.ts
│   │   └── moderation.service.ts
│   │
│   ├── inngest/
│   │   ├── client.ts                 # Inngest client
│   │   └── functions/
│   │       ├── notifications.ts      # Email notifications
│   │       └── digests.ts            # Daily digest
│   │
│   ├── utils/
│   │   ├── cn.ts                     # Class name utility
│   │   ├── date.ts                   # Date formatting (Romanian)
│   │   ├── validation.ts             # Zod schemas
│   │   └── sanitize.ts               # XSS prevention
│   │
│   ├── hooks/
│   │   ├── use-feed.ts               # Feed data hook
│   │   ├── use-posts.ts              # Post mutations
│   │   ├── use-notifications.ts      # Notifications hook
│   │   └── use-user.ts               # Current user hook
│   │
│   ├── i18n/
│   │   └── ro.ts                     # Romanian translations
│   │
│   └── rate-limit.ts                 # Upstash rate limiting
│
├── prisma/
│   ├── schema.prisma                 # Database schema
│   └── migrations/                   # Database migrations
│
├── public/
│   ├── icons/                        # App icons
│   ├── images/                       # Static images
│   └── manifest.json                 # PWA manifest
│
├── .env.local                        # Local environment variables
├── .env.example                      # Example env file
├── middleware.ts                     # Next.js middleware (auth + rate limit)
├── next.config.js                    # Next.js configuration
├── tailwind.config.ts                # Tailwind configuration
├── tsconfig.json                     # TypeScript configuration
└── package.json
```

---

## Part 6: Development Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Working authentication + basic UI shell

**Tasks:**
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Set up Supabase project (DB + Auth + Storage)
- [ ] Configure Prisma with database schema
- [ ] Run initial migration
- [ ] Install Tailwind CSS
- [ ] Initialize shadcn/ui
- [ ] Add core components: button, card, input, avatar, dialog, toast
- [ ] Build auth pages: register, login, email verification
- [ ] Implement auth API routes
- [ ] Create responsive app shell (mobile nav + desktop sidebar)
- [ ] Add neighborhood selection to onboarding
- [ ] Deploy to Vercel
- [ ] Set up GitHub repo with CI/CD

**Key Files:**
- `prisma/schema.prisma`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `components/layout/app-shell.tsx`
- `middleware.ts`

**Deliverable:** User can register, verify email, login, select neighborhood, and see empty feed.

---

### Phase 2: Core Social Features (Week 3-4)
**Goal:** Working feed with posts and comments

**Tasks:**
- [ ] Post CRUD API endpoints
- [ ] Image upload service (Supabase Storage + Sharp thumbnails)
- [ ] Feed page with infinite scroll
- [ ] Category filtering tabs (ALERT, SELL, SERVICE, QUESTION)
- [ ] Post card component
- [ ] Post detail page
- [ ] Comments CRUD API
- [ ] Comment list and form components
- [ ] Empty states ("No posts yet...")
- [ ] Loading skeletons
- [ ] Pull-to-refresh on mobile

**Key Files:**
- `app/api/posts/route.ts`
- `app/api/posts/[id]/route.ts`
- `app/api/posts/[id]/comments/route.ts`
- `lib/services/feed.service.ts`
- `lib/services/image.service.ts`
- `components/feed/post-card.tsx`
- `components/feed/post-list.tsx`
- `components/feed/post-form.tsx`
- `components/comments/comment-list.tsx`

**Deliverable:** User can create posts with images, view feed, filter by category, comment on posts.

---

### Phase 3: Notifications & Engagement (Week 5-6)
**Goal:** Users have reasons to return to the app

**Tasks:**
- [ ] Notifications API endpoints
- [ ] In-app notification bell with badge
- [ ] Notification list page
- [ ] Email notifications via Resend:
  - New comment on your post
  - Reply to your comment
- [ ] Daily digest background job (Inngest)
- [ ] "Mark as sold" for marketplace posts
- [ ] "Resolved" status for questions
- [ ] View count tracking

**Key Files:**
- `app/api/notifications/route.ts`
- `lib/inngest/functions/notifications.ts`
- `lib/inngest/functions/digests.ts`
- `lib/services/notification.service.ts`
- `components/layout/notification-bell.tsx`
- `app/(main)/notifications/page.tsx`

**Deliverable:** Users get notified when others interact with their content. Daily digest emails.

---

### Phase 4: Moderation & Safety (Week 7-8)
**Goal:** Keep the community clean and safe

**Tasks:**
- [ ] Report system (posts, comments, users)
- [ ] Report API endpoint
- [ ] Admin dashboard layout
- [ ] Reports queue page
- [ ] Admin actions: hide post, hide comment, ban user
- [ ] Rate limiting via Upstash:
  - 10 posts per hour
  - 30 comments per hour
  - 5 auth attempts per 15 minutes
- [ ] Basic profanity filter (Romanian word list)
- [ ] Content sanitization (XSS prevention)

**Key Files:**
- `app/api/reports/route.ts`
- `app/api/admin/reports/route.ts`
- `app/admin/reports/page.tsx`
- `lib/rate-limit.ts`
- `lib/utils/sanitize.ts`
- `middleware.ts` (add rate limiting)

**Deliverable:** Users can report bad content. Admins can moderate. Spam is limited.

---

### Phase 5: Polish & Preparation (Week 9-10)
**Goal:** Production-ready quality

**Tasks:**
- [ ] Error handling (user-friendly error messages)
- [ ] Error boundary component
- [ ] Performance optimization:
  - Feed caching with Upstash Redis
  - Image lazy loading
  - Code splitting
- [ ] SEO meta tags
- [ ] Open Graph images
- [ ] "About" page
- [ ] "How it works" page
- [ ] Privacy policy (GDPR compliant)
- [ ] Terms of Service
- [ ] Account deletion flow (GDPR)
- [ ] Onboarding improvements
- [ ] Mobile testing (iOS Safari, Android Chrome)
- [ ] Accessibility audit (basic)

**Key Files:**
- `lib/services/feed.service.ts` (add caching)
- `app/(main)/about/page.tsx`
- `app/(main)/privacy/page.tsx`
- `app/(main)/terms/page.tsx`
- `components/shared/error-boundary.tsx`

**Deliverable:** App feels polished, loads fast, handles errors gracefully, has legal pages.

---

### Phase 6: Pilot Launch (Week 11-12)
**Goal:** Real users in Timișoara

**Tasks:**
- [ ] Add Timișoara neighborhoods to database:
  - Fabric
  - Complexul Studențesc
  - Lipovei
  - Dacia
  - Circumvalațiunii
- [ ] Seed 15-20 real posts (you + friends)
- [ ] Create launch materials:
  - Facebook group post text
  - Instagram story template
  - Flyer design with QR code
- [ ] Join local Facebook groups, post about the app
- [ ] Print and distribute flyers in pilot neighborhood
- [ ] Talk to local businesses (potential advertisers)
- [ ] Monitor metrics daily:
  - Signups
  - Daily active users
  - Posts per day
  - Comments per day
- [ ] Collect user feedback (in-app or via form)
- [ ] Fix critical bugs immediately
- [ ] Respond to user reports within 24 hours

**Deliverable:** 100-200 real users in one Timișoara neighborhood, actively using the app.

---

## Part 7: User Flows

### Flow 1: New User Registration
```
1. User lands on homepage
2. Clicks "Înregistrează-te" (Register)
3. Enters: full name, email, password
4. Submits form
5. Receives email with verification link
6. Clicks verification link
7. Redirected to neighborhood selection
8. Selects city (Timișoara) and neighborhood (Fabric)
9. Redirected to feed
10. Sees welcome message + CTA to create first post
```

### Flow 2: Creating a Post
```
1. User clicks "+" button (mobile) or "Postare nouă" (desktop)
2. Selects category: Alertă / Vând / Cumpăr / Servicii / Întrebare / Eveniment
3. If SELL/BUY: price field appears
4. Writes title (optional) and body (required)
5. Optionally adds up to 4 images
6. Clicks "Publică"
7. Post appears at top of feed
8. User redirected to post detail page
```

### Flow 3: Commenting
```
1. User views post detail page
2. Scrolls to comments section
3. Types comment in input field
4. Clicks "Comentează"
5. Comment appears in list
6. Post author receives email notification
```

### Flow 4: Reporting Content
```
1. User sees inappropriate post/comment
2. Clicks "..." menu
3. Selects "Raportează"
4. Dialog appears with reason options:
   - Spam
   - Conținut ofensator
   - Înșelătorie
   - Hărțuire
   - Altele
5. Optionally adds details
6. Clicks "Trimite raport"
7. Toast confirms: "Raport trimis. Mulțumim!"
```

### Flow 5: Admin Moderation
```
1. Admin logs in (role = 'admin')
2. Sees notification badge on admin link
3. Goes to /admin/reports
4. Sees list of pending reports
5. Clicks on report to view details
6. Sees reported content + reporter info
7. Takes action:
   - Dismiss (false report)
   - Hide content
   - Delete content
   - Ban user
8. Report marked as handled
9. Optionally notifies reporter of action taken
```

---

## Part 8: UI/UX Guidelines

### Design System (Without Designer)

**Component Library:** shadcn/ui
- Copy-paste components (full control)
- Built on Radix UI (accessible by default)
- Tailwind-based styling

**Install these shadcn/ui components:**
```bash
npx shadcn@latest add button card input textarea avatar
npx shadcn@latest add dropdown-menu dialog toast tabs badge skeleton
npx shadcn@latest add alert form label select
```

### Color Palette

```typescript
// tailwind.config.ts
colors: {
  // Primary brand color (community/growth)
  brand: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',  // Primary
    600: '#16a34a',
    700: '#15803d',
  },

  // Category colors
  category: {
    alert: '#ef4444',      // Red - urgent
    sell: '#3b82f6',       // Blue - marketplace
    buy: '#8b5cf6',        // Purple - marketplace
    service: '#f59e0b',    // Amber - services
    question: '#06b6d4',   // Cyan - questions
    event: '#ec4899',      // Pink - events
  }
}
```

### Typography

**Font:** Inter (excellent Romanian diacritics: ă, â, î, ș, ț)

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],  // latin-ext for diacritics
  display: 'swap',
});
```

### Mobile-First Responsive Design

```
Default (0-639px):   Mobile - bottom navigation, full-width cards
sm (640px+):         Large phones - slightly larger touch targets
md (768px+):         Tablets - 2-column layout possible
lg (1024px+):        Laptops - sidebar navigation, max-width content
xl (1280px+):        Desktops - comfortable spacing
```

### Key UI Components

**Post Card:**
- Category badge (colored)
- Author avatar + name + time
- Title (if present)
- Body (truncated to 3 lines in feed)
- Image preview (first image)
- Comment count
- "..." menu (report, edit if owner)

**Mobile Bottom Navigation:**
- Home (feed)
- Search
- Create (+)
- Notifications
- Profile

**Desktop Sidebar:**
- Logo
- Navigation links
- Neighborhood selector
- User profile section

---

## Part 9: Testing & Verification

### Manual Testing Checklist

**Authentication:**
- [ ] Register with valid email
- [ ] Receive verification email
- [ ] Verify email via link
- [ ] Login with correct credentials
- [ ] Login fails with wrong password
- [ ] Logout works
- [ ] Protected pages redirect to login

**Posts:**
- [ ] Create post in each category
- [ ] Upload 1, 2, 4 images
- [ ] Edit own post
- [ ] Delete own post
- [ ] Cannot edit/delete others' posts
- [ ] Feed shows posts from correct neighborhood
- [ ] Category filter works
- [ ] Infinite scroll loads more posts

**Comments:**
- [ ] Add comment
- [ ] Edit own comment
- [ ] Delete own comment
- [ ] Threaded replies work

**Notifications:**
- [ ] Receive notification on new comment
- [ ] Email sent for new comment
- [ ] Mark notification as read
- [ ] Mark all as read

**Moderation:**
- [ ] Report post works
- [ ] Report appears in admin queue
- [ ] Admin can hide post
- [ ] Hidden post disappears from feed
- [ ] Admin can ban user
- [ ] Banned user cannot login

**Mobile:**
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Bottom navigation works
- [ ] Touch targets are 44px+
- [ ] Forms work on mobile keyboard

### Performance Targets

| Metric | Target |
|--------|--------|
| Feed load time | < 2 seconds |
| Time to Interactive | < 3 seconds on 3G |
| Image upload | < 5 seconds |
| Lighthouse Performance | > 80 |
| Lighthouse Accessibility | > 90 |

### Security Checklist

- [ ] SQL injection blocked (Prisma parameterized queries)
- [ ] XSS sanitized in post/comment content
- [ ] CSRF protection enabled
- [ ] Rate limiting active on all endpoints
- [ ] Auth tokens are httpOnly cookies
- [ ] File uploads validated (type, size)
- [ ] Admin routes check role
- [ ] Users can only edit/delete own content

---

## Part 10: Success Metrics (Pilot)

### Target Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Registered users | 200+ | Database count |
| Email verified | 80%+ | verified_at not null |
| Weekly Active Users | 50+ (25% WAU) | Users with activity in 7 days |
| Daily Active Users | 20+ | Users with activity today |
| Posts per week | 20+ | Posts created in 7 days |
| Comments per week | 50+ | Comments created in 7 days |
| Return rate (7-day) | 30%+ | Users who return within 7 days |
| Reports handled | < 24h | Time from report to action |

### What Success Looks Like

**Good signs:**
- Users posting without prompting
- Organic conversations in comments
- Users sharing the app with neighbors
- Local businesses asking to advertise
- Feature requests from users

**Bad signs:**
- Users register but never post
- Feed is empty or spam-filled
- High report rate
- Users complain about bugs
- Zero word-of-mouth growth

---

## Part 11: Scaling Notes (Post-MVP)

### When to Add What

| Milestone | Action |
|-----------|--------|
| 1K users | Add Upstash Redis caching for feeds |
| 5K users | Add Sentry for error monitoring |
| 10K users | Consider database read replica |
| 20K users | Add full-text search (PostgreSQL GIN) |
| 50K users | Extract notification service |
| 100K users | Consider moving to self-hosted infrastructure |

### Mobile App Strategy

**When:** After web MVP is validated (3-6 months)

**Options:**
1. **React Native** - Share some code with web
2. **Expo** - Faster development, OTA updates
3. **PWA improvements** - Push notifications, offline

**Recommendation:** Start with PWA improvements (web push notifications, offline caching), then build React Native app if users request native experience.

### Monetization Roadmap (Post-Pilot)

1. **Local business ads** - Promoted posts in feed (50-150 lei/month)
2. **Featured listings** - Marketplace post boost (20-50 lei/post)
3. **Verified service providers** - Badge + priority listing (100-300 lei/month)
4. **HOA/Association tools** - Block-level communication (5-10 lei/apartment)

---

## Part 12: Environment Variables

```env
# .env.example

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Vecinu

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Database (Supabase Postgres)
DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres

# Email (Resend)
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@vecinu.ro

# Background Jobs (Inngest)
INNGEST_EVENT_KEY=xxx
INNGEST_SIGNING_KEY=xxx

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=xxx
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## Summary

This development plan provides everything needed to build Vecinu:

1. **Simplified tech stack** - Next.js monolith instead of microservices
2. **Cost-effective** - 0-10 EUR/month during validation phase
3. **Mobile-first** - shadcn/ui for professional UI without a designer
4. **Security built-in** - Email verification, rate limiting, moderation
5. **Clear phases** - 6 phases over 12 weeks to pilot launch
6. **Measurable success** - Defined metrics to know if pilot works
7. **Scalable foundation** - Can grow to 100K+ users without major rewrite

The goal: Ship to one neighborhood in Timișoara and validate that people actually use it before adding complexity.

---

**Ready to start? Review this plan and let me know when you're ready to begin Phase 1.**

---

## Part 13: Critical Gaps & Fixes (Deep Dive Review)

This section documents findings from a comprehensive three-agent deep dive review covering technical architecture, feature completeness, and implementation readiness.

### Review Scores Summary

| Review Area | Score | Status |
|-------------|-------|--------|
| **Technical Architecture** | 7.2/10 | Solid foundation, needs security hardening |
| **Feature Completeness** | 8.5/10 | Most essentials covered, few critical gaps |
| **Implementation Readiness** | 5.5/10 | Strategic direction excellent, tactical detail was missing |

### Priority 1: Must Fix Before Development (BLOCKING)

| Gap | Impact | Solution |
|-----|--------|----------|
| **Search Functionality** | HIGH - Users can't find posts | Add search endpoint in Phase 2, not Phase 5 |
| **Validation Schemas** | BLOCKING - Every endpoint needs validation | Create Zod schemas (see Part 16) |
| **Error Handling** | BLOCKING - No error classes defined | Implement error strategy (see Part 17) |
| **Image Upload Pipeline** | BLOCKING - No implementation details | Document pipeline (see Part 18) |
| **Address Verification** | HIGH - Critical for trust | Add verification endpoint and flow |

### Priority 2: Must Fix Before Launch

| Gap | Impact | Solution |
|-----|--------|----------|
| **Security Headers** | Security vulnerability | Add CSP, X-Frame-Options in next.config.js |
| **CORS Configuration** | Unauthorized API access | Configure allowed origins explicitly |
| **Error Monitoring** | Can't see production bugs | Add Sentry from Day 1, not at 5K users |
| **Testing Framework** | No regression protection | Add Vitest + Playwright |
| **CI/CD Pipeline** | Manual deployments error-prone | Create GitHub Actions workflow |
| **Banned User Check** | Banned users can still post | Check `is_banned` on every request |
| **GDPR Data Export** | Legal requirement in EU | Add export endpoint |

### Priority 3: Should Fix Before 1K Users

| Gap | Impact | Solution |
|-----|--------|----------|
| **Notification Retention** | Unbounded table growth | Auto-delete after 90 days |
| **Post Table Partitioning** | Query slowdown at scale | Plan time-based partitioning |
| **Image Cleanup** | Storage bloat | Delete orphaned images |
| **Feed Caching** | Performance at scale | Document TTL and invalidation |
| **Messaging System** | Marketplace transactions difficult | Add MVP-lite DMs |
| **Public User Profiles** | Can't view other users | Add GET /api/users/:id |

### Timeline Reality Check

| Phase | Original | Realistic | Reason |
|-------|----------|-----------|--------|
| Phase 1 (Foundation) | 2 weeks | **3 weeks** | Setup, validation, error handling |
| Phase 2 (Core Social) | 2 weeks | **3-4 weeks** | Image upload complexity |
| Phase 3 (Notifications) | 2 weeks | **2.5 weeks** | Email templates, Inngest |
| Phase 4 (Moderation) | 2 weeks | **2 weeks** | Straightforward |
| Phase 5 (Polish) | 2 weeks | **3 weeks** | Performance, testing |
| Phase 6 (Launch) | 2 weeks | **2 weeks** | Marketing/ops |
| **TOTAL** | **12 weeks** | **16-17 weeks** | Buffer for unknowns |

---

## Part 14: Additional Database Tables

### Tables to Add for MVP

```sql
-- ============================================
-- SAVED POSTS (Bookmarks)
-- ============================================
CREATE TABLE saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_saved_posts_user ON saved_posts(user_id, created_at DESC);


-- ============================================
-- USER BLOCKS (Muting/Blocking)
-- ============================================
CREATE TABLE user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_user_id)
);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);


-- ============================================
-- DIRECT MESSAGES (MVP-lite for Marketplace)
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL, -- Optional: linked to marketplace post
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);


-- ============================================
-- ADDRESS VERIFICATION REQUESTS
-- ============================================
CREATE TABLE address_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Verification method
  method VARCHAR(20) NOT NULL,           -- 'postal_code', 'phone', 'manual'

  -- Address details
  street_address TEXT,
  postal_code VARCHAR(20),
  city VARCHAR(100),

  -- Verification status
  status VARCHAR(20) DEFAULT 'pending',  -- pending, verified, rejected
  verification_code VARCHAR(10),         -- For postal/phone verification
  code_expires_at TIMESTAMPTZ,

  -- Admin review (for manual verification)
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX idx_address_verifications_user ON address_verifications(user_id);
CREATE INDEX idx_address_verifications_status ON address_verifications(status);
```

### Additional Indexes for Performance

```sql
-- Posts expiration (for cleanup jobs)
CREATE INDEX idx_posts_expires ON posts(expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;

-- Full-text search on posts (add in Phase 2)
ALTER TABLE posts ADD COLUMN search_vector tsvector;
CREATE INDEX idx_posts_search ON posts USING GIN(search_vector);

-- Trigger to update search vector
CREATE OR REPLACE FUNCTION posts_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('romanian', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('romanian', COALESCE(NEW.body, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_search_update
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_trigger();
```

---

## Part 15: Missing API Endpoints

### Search Endpoints (Add to Phase 2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search` | Search posts by keyword |

**Query Parameters:**
- `q` (required): Search query string
- `neighborhood` (required): Neighborhood slug
- `category` (optional): Filter by category
- `cursor` (optional): Pagination cursor
- `limit` (optional): Items per page (default: 20)

### User Endpoints (Additional)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:id` | Get public user profile |
| GET | `/api/users/:id/posts` | Get user's public posts |
| POST | `/api/users/me/verify-address` | Start address verification |
| GET | `/api/users/me/verify-address/status` | Check verification status |
| POST | `/api/users/me/verify-address/confirm` | Confirm with code |
| PATCH | `/api/users/me/preferences` | Update notification preferences |
| POST | `/api/users/me/export` | Request GDPR data export |
| GET | `/api/users/me/export/:token` | Download exported data |

### Post Endpoints (Additional)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/posts/:id/save` | Save/bookmark post |
| DELETE | `/api/posts/:id/save` | Remove from saved |
| GET | `/api/posts/saved` | Get user's saved posts |
| DELETE | `/api/posts/:id/images/:imageId` | Delete specific image |

### Messaging Endpoints (MVP-lite)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List user's conversations |
| POST | `/api/conversations` | Start new conversation |
| GET | `/api/conversations/:id/messages` | Get messages in conversation |
| POST | `/api/conversations/:id/messages` | Send message |
| PATCH | `/api/conversations/:id/read` | Mark conversation as read |

### Admin Endpoints (Additional)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/neighborhoods` | List all neighborhoods |
| POST | `/api/admin/neighborhoods` | Create neighborhood |
| PATCH | `/api/admin/neighborhoods/:id` | Update neighborhood |
| GET | `/api/admin/users` | List users with filters |
| GET | `/api/admin/analytics` | Detailed analytics data |

---

## Part 16: Validation Schemas (Zod)

Create `lib/validations/` directory with the following schemas:

### Auth Schemas (`lib/validations/auth.ts`)

```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string()
    .min(2, 'Numele trebuie să aibă cel puțin 2 caractere')
    .max(100, 'Numele nu poate depăși 100 de caractere'),
  email: z.string()
    .email('Adresa de email nu este validă'),
  password: z.string()
    .min(8, 'Parola trebuie să aibă cel puțin 8 caractere')
    .regex(/[A-Z]/, 'Parola trebuie să conțină cel puțin o literă mare')
    .regex(/[0-9]/, 'Parola trebuie să conțină cel puțin o cifră'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Parolele nu coincid',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: z.string().email('Adresa de email nu este validă'),
  password: z.string().min(1, 'Parola este obligatorie'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Adresa de email nu este validă'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string()
    .min(8, 'Parola trebuie să aibă cel puțin 8 caractere')
    .regex(/[A-Z]/, 'Parola trebuie să conțină cel puțin o literă mare')
    .regex(/[0-9]/, 'Parola trebuie să conțină cel puțin o cifră'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Parolele nu coincid',
  path: ['confirmPassword'],
});
```

### Post Schemas (`lib/validations/post.ts`)

```typescript
import { z } from 'zod';

export const postCategoryEnum = z.enum([
  'ALERT', 'SELL', 'BUY', 'SERVICE', 'QUESTION', 'EVENT', 'LOST_FOUND'
]);

export const createPostSchema = z.object({
  title: z.string()
    .max(200, 'Titlul nu poate depăși 200 de caractere')
    .optional(),
  body: z.string()
    .min(10, 'Conținutul trebuie să aibă cel puțin 10 caractere')
    .max(5000, 'Conținutul nu poate depăși 5000 de caractere'),
  category: postCategoryEnum,
  priceCents: z.number()
    .int()
    .min(0, 'Prețul nu poate fi negativ')
    .max(100000000, 'Prețul este prea mare') // 1M RON max
    .optional(),
  isFree: z.boolean().optional(),
  images: z.array(z.object({
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    position: z.number().int().min(0).max(3)
  })).max(4, 'Poți adăuga maximum 4 imagini').optional(),
});

export const updatePostSchema = createPostSchema.partial().extend({
  status: z.enum(['active', 'sold', 'resolved']).optional(),
});

export const postQuerySchema = z.object({
  neighborhood: z.string().min(1),
  category: postCategoryEnum.optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const searchQuerySchema = z.object({
  q: z.string().min(2, 'Căutarea trebuie să aibă cel puțin 2 caractere').max(100),
  neighborhood: z.string().min(1),
  category: postCategoryEnum.optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
```

### Comment Schemas (`lib/validations/comment.ts`)

```typescript
import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string()
    .min(1, 'Comentariul nu poate fi gol')
    .max(2000, 'Comentariul nu poate depăși 2000 de caractere'),
  parentId: z.string().uuid().optional(), // For threaded replies
});

export const updateCommentSchema = z.object({
  body: z.string()
    .min(1, 'Comentariul nu poate fi gol')
    .max(2000, 'Comentariul nu poate depăși 2000 de caractere'),
});
```

### User Schemas (`lib/validations/user.ts`)

```typescript
import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string()
    .min(2, 'Numele trebuie să aibă cel puțin 2 caractere')
    .max(100)
    .optional(),
  displayName: z.string()
    .max(50)
    .optional()
    .nullable(),
  bio: z.string()
    .max(500, 'Biografia nu poate depăși 500 de caractere')
    .optional()
    .nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

export const joinNeighborhoodSchema = z.object({
  neighborhoodId: z.string().uuid(),
});

export const updatePreferencesSchema = z.object({
  emailComments: z.boolean().optional(),
  emailAlerts: z.boolean().optional(),
  emailDigest: z.enum(['daily', 'weekly', 'never']).optional(),
  pushEnabled: z.boolean().optional(),
});
```

### Report Schemas (`lib/validations/report.ts`)

```typescript
import { z } from 'zod';

export const reportReasonEnum = z.enum([
  'spam', 'harassment', 'scam', 'inappropriate', 'dangerous', 'other'
]);

export const createReportSchema = z.object({
  targetType: z.enum(['POST', 'COMMENT', 'USER']),
  targetId: z.string().uuid(),
  reason: reportReasonEnum,
  details: z.string().max(1000).optional(),
});

export const adminActionSchema = z.object({
  status: z.enum(['reviewed', 'actioned', 'dismissed']),
  actionTaken: z.enum(['warning', 'hide', 'delete', 'ban', 'none']).optional(),
});
```

---

## Part 17: Error Handling Strategy

### Error Classes (`lib/errors/index.ts`)

```typescript
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, public errors?: Record<string, string[]>) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Trebuie să fii autentificat') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Nu ai permisiunea să faci această acțiune') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resursa') {
    super(404, `${resource} nu a fost găsită`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfter?: number) {
    super(429, 'Prea multe cereri. Încearcă din nou mai târziu.', 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'A apărut o eroare internă') {
    super(500, message, 'INTERNAL_ERROR');
    this.name = 'InternalServerError';
  }
}
```

### Error Handler Middleware (`lib/errors/handler.ts`)

```typescript
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApiError, ValidationError, InternalServerError } from './index';
import * as Sentry from '@sentry/nextjs';

export function handleApiError(error: unknown): NextResponse {
  // Log to Sentry for production debugging
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error);
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!errors[path]) errors[path] = [];
      errors[path].push(err.message);
    });

    return NextResponse.json(
      {
        error: 'Datele introduse nu sunt valide',
        code: 'VALIDATION_ERROR',
        details: errors
      },
      { status: 400 }
    );
  }

  // Known API errors
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error instanceof ValidationError && { details: error.errors })
      },
      { status: error.statusCode }
    );
  }

  // Unknown errors - log and return generic message
  console.error('Unhandled error:', error);

  return NextResponse.json(
    {
      error: 'A apărut o eroare internă',
      code: 'INTERNAL_ERROR'
    },
    { status: 500 }
  );
}
```

### API Response Format

```typescript
// Success response
{
  "data": { ... },
  "meta": {
    "cursor": "next-page-cursor",
    "hasMore": true
  }
}

// Error response
{
  "error": "Human-readable error message in Romanian",
  "code": "ERROR_CODE",
  "details": { ... } // Optional: field-level errors for validation
}
```

### Romanian Error Messages

```typescript
// lib/i18n/errors.ts
export const errorMessages = {
  // Auth
  'auth/invalid-credentials': 'Email sau parolă incorectă',
  'auth/email-exists': 'Această adresă de email este deja folosită',
  'auth/email-not-verified': 'Te rugăm să îți verifici adresa de email',
  'auth/account-banned': 'Contul tău a fost suspendat',
  'auth/session-expired': 'Sesiunea ta a expirat. Te rugăm să te autentifici din nou',

  // Posts
  'post/not-found': 'Postarea nu a fost găsită',
  'post/not-owner': 'Nu poți edita această postare',
  'post/rate-limited': 'Ai atins limita de postări. Încearcă din nou mai târziu',

  // Comments
  'comment/not-found': 'Comentariul nu a fost găsit',
  'comment/rate-limited': 'Ai atins limita de comentarii. Încearcă din nou mai târziu',

  // General
  'rate-limited': 'Prea multe cereri. Încearcă din nou în {seconds} secunde',
  'unauthorized': 'Trebuie să fii autentificat',
  'forbidden': 'Nu ai permisiunea să faci această acțiune',
  'internal-error': 'A apărut o eroare. Te rugăm să încerci din nou',
};
```

---

## Part 18: Image Upload Pipeline

### Configuration (`lib/config/images.ts`)

```typescript
export const IMAGE_CONFIG = {
  // Size limits
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_IMAGES_PER_POST: 4,

  // Supported formats
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ],

  // Processing settings
  ORIGINAL_MAX_WIDTH: 1920,
  ORIGINAL_MAX_HEIGHT: 1920,
  ORIGINAL_QUALITY: 85,

  THUMBNAIL_WIDTH: 400,
  THUMBNAIL_HEIGHT: 400,
  THUMBNAIL_QUALITY: 80,

  // Output format
  OUTPUT_FORMAT: 'webp', // Convert all to WebP for smaller size

  // Storage paths
  STORAGE_BUCKET: 'post-images',
  PATH_TEMPLATE: 'posts/{postId}/{imageId}', // e.g., posts/abc-123/img-456.webp
};
```

### Image Service (`lib/services/image.service.ts`)

```typescript
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { IMAGE_CONFIG } from '@/lib/config/images';
import { ValidationError } from '@/lib/errors';

interface ImageMetadata {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export class ImageService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async validateFile(file: File): Promise<void> {
    // Check file size
    if (file.size > IMAGE_CONFIG.MAX_FILE_SIZE) {
      throw new ValidationError(
        `Fișierul este prea mare. Limita este ${IMAGE_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    // Check MIME type
    if (!IMAGE_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new ValidationError(
        'Format de fișier neacceptat. Folosește JPG, PNG, WebP sau GIF'
      );
    }

    // Validate image headers (prevent XSS via SVG, etc.)
    const buffer = await file.arrayBuffer();
    const metadata = await sharp(buffer).metadata();

    if (!metadata.width || !metadata.height) {
      throw new ValidationError('Fișierul nu este o imagine validă');
    }
  }

  async processAndUpload(
    file: File,
    postId: string
  ): Promise<ImageMetadata> {
    await this.validateFile(file);

    const imageId = crypto.randomUUID();
    const buffer = await file.arrayBuffer();

    // Process original (resize if too large, convert to WebP)
    const originalBuffer = await sharp(buffer)
      .resize(IMAGE_CONFIG.ORIGINAL_MAX_WIDTH, IMAGE_CONFIG.ORIGINAL_MAX_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: IMAGE_CONFIG.ORIGINAL_QUALITY })
      .toBuffer();

    // Generate thumbnail
    const thumbnailBuffer = await sharp(buffer)
      .resize(IMAGE_CONFIG.THUMBNAIL_WIDTH, IMAGE_CONFIG.THUMBNAIL_HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: IMAGE_CONFIG.THUMBNAIL_QUALITY })
      .toBuffer();

    // Get final dimensions
    const metadata = await sharp(originalBuffer).metadata();

    // Upload to Supabase Storage
    const originalPath = `posts/${postId}/${imageId}.webp`;
    const thumbnailPath = `posts/${postId}/${imageId}_thumb.webp`;

    const [originalUpload, thumbnailUpload] = await Promise.all([
      this.supabase.storage
        .from(IMAGE_CONFIG.STORAGE_BUCKET)
        .upload(originalPath, originalBuffer, {
          contentType: 'image/webp',
          cacheControl: '31536000' // 1 year cache
        }),
      this.supabase.storage
        .from(IMAGE_CONFIG.STORAGE_BUCKET)
        .upload(thumbnailPath, thumbnailBuffer, {
          contentType: 'image/webp',
          cacheControl: '31536000'
        })
    ]);

    if (originalUpload.error || thumbnailUpload.error) {
      throw new Error('Failed to upload image');
    }

    // Get public URLs
    const { data: { publicUrl: originalUrl } } = this.supabase.storage
      .from(IMAGE_CONFIG.STORAGE_BUCKET)
      .getPublicUrl(originalPath);

    const { data: { publicUrl: thumbnailUrl } } = this.supabase.storage
      .from(IMAGE_CONFIG.STORAGE_BUCKET)
      .getPublicUrl(thumbnailPath);

    return {
      id: imageId,
      url: originalUrl,
      thumbnailUrl,
      width: metadata.width!,
      height: metadata.height!,
      sizeBytes: originalBuffer.length
    };
  }

  async deletePostImages(postId: string): Promise<void> {
    const { data: files } = await this.supabase.storage
      .from(IMAGE_CONFIG.STORAGE_BUCKET)
      .list(`posts/${postId}`);

    if (files && files.length > 0) {
      const paths = files.map(f => `posts/${postId}/${f.name}`);
      await this.supabase.storage
        .from(IMAGE_CONFIG.STORAGE_BUCKET)
        .remove(paths);
    }
  }
}
```

### Client-Side Upload Component

```typescript
// components/feed/image-upload.tsx
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { IMAGE_CONFIG } from '@/lib/config/images';

interface ImageUploadProps {
  onImagesChange: (images: File[]) => void;
  maxImages?: number;
}

export function ImageUpload({
  onImagesChange,
  maxImages = IMAGE_CONFIG.MAX_IMAGES_PER_POST
}: ImageUploadProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = [...files, ...acceptedFiles].slice(0, maxImages);
    setFiles(newFiles);

    // Generate previews
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => {
      prev.forEach(url => URL.revokeObjectURL(url)); // Cleanup old URLs
      return newPreviews;
    });

    onImagesChange(newFiles);
  }, [files, maxImages, onImagesChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif']
    },
    maxSize: IMAGE_CONFIG.MAX_FILE_SIZE,
    maxFiles: maxImages - files.length,
    disabled: files.length >= maxImages
  });

  const removeImage = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    URL.revokeObjectURL(previews[index]);
    setPreviews(prev => prev.filter((_, i) => i !== index));
    onImagesChange(newFiles);
  };

  return (
    <div>
      {files.length < maxImages && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            ${isDragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-300'}`}
        >
          <input {...getInputProps()} />
          <p>Trage imaginile aici sau click pentru a selecta</p>
          <p className="text-sm text-gray-500">
            Maximum {maxImages} imagini, {IMAGE_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB fiecare
          </p>
        </div>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative">
              <img src={preview} alt="" className="rounded-lg object-cover w-full h-32" />
              <button
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Part 19: Security Implementation

### Security Headers (`next.config.js`)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)'
          },
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline';
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: https://*.supabase.co;
              font-src 'self';
              connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.upstash.io;
              frame-ancestors 'none';
            `.replace(/\n/g, '')
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

### Rate Limiting Configuration (`lib/rate-limit.ts`)

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Different rate limiters for different actions
export const rateLimiters = {
  // Auth: 5 attempts per 15 minutes
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    prefix: 'ratelimit:auth',
  }),

  // Posts: 10 per hour
  createPost: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'ratelimit:posts',
  }),

  // Comments: 30 per hour
  createComment: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 h'),
    prefix: 'ratelimit:comments',
  }),

  // Reports: 10 per day
  createReport: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '24 h'),
    prefix: 'ratelimit:reports',
  }),

  // Password reset: 3 per hour per email
  passwordReset: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    prefix: 'ratelimit:password-reset',
  }),

  // Email verification resend: 3 per hour
  verificationResend: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    prefix: 'ratelimit:verification',
  }),

  // Image upload: 20 per hour
  imageUpload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'ratelimit:images',
  }),
};

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}
```

### Auth Middleware with Ban Check (`middleware.ts`)

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Check authentication for protected routes
  const { data: { session } } = await supabase.auth.getSession();

  const isAuthRoute = req.nextUrl.pathname.startsWith('/api/auth');
  const isPublicRoute = ['/login', '/register', '/verify-email', '/forgot-password'].some(
    path => req.nextUrl.pathname.startsWith(path)
  );
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin') ||
                       req.nextUrl.pathname.startsWith('/api/admin');

  // Rate limit auth endpoints
  if (isAuthRoute && req.method === 'POST') {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'unknown';
    const { success, remaining, reset } = await checkRateLimit(rateLimiters.auth, ip);

    if (!success) {
      return NextResponse.json(
        { error: 'Prea multe încercări. Încearcă din nou mai târziu.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          }
        }
      );
    }
  }

  // Require auth for protected routes
  if (!session && !isAuthRoute && !isPublicRoute) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Check if user is banned (on every request for authenticated users)
  if (session) {
    const { data: user } = await supabase
      .from('users')
      .select('is_banned, role')
      .eq('id', session.user.id)
      .single();

    if (user?.is_banned) {
      // Sign out banned user
      await supabase.auth.signOut();

      if (req.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Contul tău a fost suspendat' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/login?error=banned', req.url));
    }

    // Admin routes require admin role
    if (isAdminRoute && user?.role !== 'admin' && user?.role !== 'moderator') {
      if (req.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/feed', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
```

### Content Sanitization (`lib/utils/sanitize.ts`)

```typescript
import DOMPurify from 'isomorphic-dompurify';

// Sanitize user-generated content to prevent XSS
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

// Sanitize plain text (strip all HTML)
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

// Sanitize URLs
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
```

---

## Part 20: CI/CD & DevOps

### GitHub Actions Workflow (`.github/workflows/deploy.yml`)

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run type-check

      - name: Run unit tests
        run: npm run test

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

  build:
    runs-on: ubuntu-latest
    needs: lint-and-test
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Database Migration Strategy

```markdown
## Migration Commands

# Generate migration after schema change
npx prisma migrate dev --name descriptive_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (ONLY in development!)
npx prisma migrate reset

## Migration Naming Convention
- `YYYYMMDD_description` (e.g., `20240115_add_saved_posts_table`)

## Before Deploying Migrations
1. Test migration locally with production data copy
2. Ensure migration is reversible if possible
3. For data migrations, create separate script
4. Deploy during low-traffic periods

## Rollback Strategy
1. Prisma doesn't support automatic rollback
2. Create reverse migration manually if needed
3. For critical issues: restore from backup
```

### Environment Variables Management

```markdown
## Local Development
- Copy `.env.example` to `.env.local`
- Fill in development values
- Never commit `.env.local`

## Staging
- Set in Vercel project settings (Preview environment)
- Use separate Supabase project for staging

## Production
- Set in Vercel project settings (Production environment)
- Use GitHub Secrets for CI/CD
- Rotate keys quarterly

## Required Secrets in GitHub
- VERCEL_TOKEN
- VERCEL_ORG_ID
- VERCEL_PROJECT_ID
- TEST_DATABASE_URL (for CI tests)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Monitoring Setup

```typescript
// lib/monitoring/sentry.ts
import * as Sentry from '@sentry/nextjs';

export function initSentry() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Error filtering
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error exception captured',
    ],

    // Before sending error
    beforeSend(event) {
      // Don't send errors in development
      if (process.env.NODE_ENV === 'development') {
        return null;
      }
      return event;
    },
  });
}

// Usage in API routes
export function captureApiError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}
```

### Logging Service (`lib/logger.ts`)

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
});

// Usage
// logger.info({ userId, action: 'post_created' }, 'User created a post');
// logger.error({ error, userId }, 'Failed to create post');
```

---

## Part 21: Updated Project Structure

```
vecinu/
├── .github/
│   └── workflows/
│       └── deploy.yml                # CI/CD pipeline
│
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Auth route group
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── verify-email/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx   # NEW
│   │   └── layout.tsx
│   │
│   ├── (main)/                       # Authenticated routes
│   │   ├── feed/page.tsx
│   │   ├── search/page.tsx           # NEW: Search page
│   │   ├── post/
│   │   │   ├── [id]/page.tsx
│   │   │   └── new/page.tsx
│   │   ├── profile/
│   │   │   ├── page.tsx              # Own profile
│   │   │   └── [id]/page.tsx         # NEW: Public profile
│   │   ├── settings/page.tsx
│   │   ├── notifications/page.tsx
│   │   ├── messages/                 # NEW: Messaging
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── saved/page.tsx            # NEW: Saved posts
│   │   └── layout.tsx
│   │
│   ├── admin/
│   │   ├── reports/page.tsx
│   │   ├── users/page.tsx
│   │   ├── neighborhoods/page.tsx    # NEW: Manage neighborhoods
│   │   ├── analytics/page.tsx        # NEW: Analytics dashboard
│   │   └── layout.tsx
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register/route.ts
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   ├── verify-email/route.ts
│   │   │   ├── forgot-password/route.ts
│   │   │   ├── reset-password/route.ts
│   │   │   └── me/route.ts
│   │   ├── posts/
│   │   │   ├── route.ts
│   │   │   ├── saved/route.ts        # NEW
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── save/route.ts     # NEW
│   │   │       ├── comments/route.ts
│   │   │       └── images/
│   │   │           └── [imageId]/route.ts  # NEW
│   │   ├── search/route.ts           # NEW
│   │   ├── comments/[id]/route.ts
│   │   ├── reports/route.ts
│   │   ├── notifications/route.ts
│   │   ├── neighborhoods/route.ts
│   │   ├── users/
│   │   │   ├── me/
│   │   │   │   ├── route.ts
│   │   │   │   ├── preferences/route.ts   # NEW
│   │   │   │   ├── verify-address/route.ts # NEW
│   │   │   │   └── export/route.ts        # NEW: GDPR export
│   │   │   └── [id]/
│   │   │       ├── route.ts          # NEW: Public profile
│   │   │       └── posts/route.ts    # NEW
│   │   ├── conversations/            # NEW: Messaging
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── messages/route.ts
│   │   │       └── read/route.ts
│   │   ├── admin/
│   │   │   ├── reports/route.ts
│   │   │   ├── posts/[id]/route.ts
│   │   │   ├── comments/[id]/route.ts
│   │   │   ├── users/[id]/route.ts
│   │   │   ├── neighborhoods/route.ts    # NEW
│   │   │   └── analytics/route.ts        # NEW
│   │   └── inngest/route.ts
│   │
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── ui/                           # shadcn/ui components
│   ├── feed/
│   │   ├── post-card.tsx
│   │   ├── post-list.tsx
│   │   ├── post-form.tsx
│   │   ├── category-filter.tsx
│   │   ├── post-image-gallery.tsx
│   │   └── image-upload.tsx          # NEW
│   ├── comments/
│   ├── layout/
│   │   ├── app-shell.tsx
│   │   ├── header.tsx
│   │   ├── mobile-bottom-nav.tsx
│   │   ├── desktop-sidebar.tsx
│   │   ├── notification-bell.tsx
│   │   └── search-bar.tsx            # NEW
│   ├── messages/                     # NEW
│   │   ├── conversation-list.tsx
│   │   ├── message-thread.tsx
│   │   └── message-input.tsx
│   └── shared/
│       ├── user-avatar.tsx
│       ├── loading-spinner.tsx
│       ├── empty-state.tsx
│       ├── error-boundary.tsx
│       └── optimized-image.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   │
│   ├── prisma/
│   │   └── client.ts
│   │
│   ├── services/
│   │   ├── feed.service.ts
│   │   ├── post.service.ts
│   │   ├── comment.service.ts
│   │   ├── notification.service.ts
│   │   ├── image.service.ts          # DETAILED
│   │   ├── moderation.service.ts
│   │   ├── search.service.ts         # NEW
│   │   └── message.service.ts        # NEW
│   │
│   ├── validations/                  # NEW: Zod schemas
│   │   ├── auth.ts
│   │   ├── post.ts
│   │   ├── comment.ts
│   │   ├── user.ts
│   │   └── report.ts
│   │
│   ├── errors/                       # NEW: Error handling
│   │   ├── index.ts
│   │   └── handler.ts
│   │
│   ├── config/                       # NEW: Configuration
│   │   ├── images.ts
│   │   └── rate-limits.ts
│   │
│   ├── inngest/
│   │   ├── client.ts
│   │   └── functions/
│   │       ├── notifications.ts
│   │       ├── digests.ts
│   │       └── cleanup.ts            # NEW: Post expiry, notification cleanup
│   │
│   ├── utils/
│   │   ├── cn.ts
│   │   ├── date.ts
│   │   └── sanitize.ts               # DETAILED
│   │
│   ├── hooks/
│   │   ├── use-feed.ts
│   │   ├── use-posts.ts
│   │   ├── use-notifications.ts
│   │   ├── use-user.ts
│   │   └── use-messages.ts           # NEW
│   │
│   ├── i18n/
│   │   ├── ro.ts
│   │   └── errors.ts                 # NEW: Error messages
│   │
│   ├── rate-limit.ts                 # DETAILED
│   ├── logger.ts                     # NEW
│   └── monitoring/
│       └── sentry.ts                 # NEW
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── tests/                            # NEW: Test structure
│   ├── unit/
│   │   ├── services/
│   │   └── utils/
│   ├── integration/
│   │   └── api/
│   └── e2e/
│       ├── auth.spec.ts
│       └── posts.spec.ts
│
├── public/
│   ├── icons/
│   ├── images/
│   └── manifest.json
│
├── .env.local
├── .env.example
├── middleware.ts                     # DETAILED
├── next.config.js                    # DETAILED with security headers
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts                  # NEW
├── playwright.config.ts              # NEW
└── package.json
```

---

## Part 22: Updated Development Phases

### Phase 1: Foundation (Week 1-3) - UPDATED

**Goal:** Working authentication + basic UI shell + validation infrastructure

**Tasks:**
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Set up Supabase project (DB + Auth + Storage)
- [ ] Configure Prisma with database schema (including new tables)
- [ ] Run initial migration
- [ ] Install and configure Tailwind CSS + shadcn/ui
- [ ] **NEW:** Set up Zod validation schemas
- [ ] **NEW:** Implement error handling classes and middleware
- [ ] **NEW:** Configure security headers in next.config.js
- [ ] **NEW:** Set up Sentry for error monitoring
- [ ] **NEW:** Create GitHub Actions CI/CD workflow
- [ ] Build auth pages: register, login, email verification, password reset
- [ ] Implement auth API routes with validation
- [ ] **NEW:** Implement rate limiting on auth endpoints
- [ ] Create responsive app shell (mobile nav + desktop sidebar)
- [ ] Add neighborhood selection to onboarding
- [ ] **NEW:** Set up logging service
- [ ] Deploy to Vercel
- [ ] Set up GitHub repo with CI/CD

**Key Files:**
- `prisma/schema.prisma`
- `lib/validations/*.ts` (NEW)
- `lib/errors/*.ts` (NEW)
- `lib/rate-limit.ts`
- `middleware.ts`
- `next.config.js` (with security headers)
- `.github/workflows/deploy.yml` (NEW)

**Deliverable:** User can register, verify email, login, select neighborhood, and see empty feed. All with proper validation, error handling, and security.

---

### Phase 2: Core Social Features (Week 4-7) - UPDATED

**Goal:** Working feed with posts, comments, and search

**Tasks:**
- [ ] Post CRUD API endpoints with validation
- [ ] **DETAILED:** Image upload service (see Part 18)
  - [ ] Sharp configuration for thumbnails
  - [ ] Supabase Storage integration
  - [ ] Client-side upload component with drag-and-drop
- [ ] **NEW:** Search API endpoint with PostgreSQL full-text search
- [ ] **NEW:** Search UI component
- [ ] Feed page with infinite scroll
- [ ] Category filtering tabs
- [ ] Post card component
- [ ] Post detail page
- [ ] Comments CRUD API
- [ ] Comment list and form components (threaded)
- [ ] **NEW:** Saved posts functionality
- [ ] Empty states
- [ ] Loading skeletons
- [ ] Pull-to-refresh on mobile
- [ ] **NEW:** Rate limiting on post/comment creation

**Key Files:**
- `app/api/posts/route.ts`
- `app/api/search/route.ts` (NEW)
- `lib/services/image.service.ts` (DETAILED)
- `lib/config/images.ts` (NEW)
- `components/feed/image-upload.tsx` (NEW)

**Deliverable:** User can create posts with images, view feed, filter by category, search posts, comment on posts, save posts.

---

### Phase 3: Notifications & Engagement (Week 8-9) - UPDATED

**Goal:** Users have reasons to return to the app

**Tasks:**
- [ ] Notifications API endpoints
- [ ] In-app notification bell with badge
- [ ] Notification list page
- [ ] **DETAILED:** Email notifications via Resend:
  - [ ] Email template design (HTML + plain text)
  - [ ] New comment notification
  - [ ] Reply notification
  - [ ] **NEW:** Unsubscribe links (GDPR)
- [ ] Daily digest background job (Inngest)
- [ ] **NEW:** Notification preferences UI
- [ ] "Mark as sold" for marketplace posts
- [ ] "Resolved" status for questions
- [ ] View count tracking
- [ ] **NEW:** Post expiry job for marketplace (30 days)
- [ ] **NEW:** Notification cleanup job (90 days retention)

**Key Files:**
- `lib/inngest/functions/notifications.ts`
- `lib/inngest/functions/cleanup.ts` (NEW)
- `app/(main)/settings/page.tsx` (preferences UI)

**Deliverable:** Users get notified when others interact with their content. Daily digest emails. Old notifications auto-deleted.

---

### Phase 4: Moderation & Safety (Week 10-11) - UPDATED

**Goal:** Keep the community clean and safe

**Tasks:**
- [ ] Report system (posts, comments, users)
- [ ] Report API endpoint with validation
- [ ] Admin dashboard layout
- [ ] Reports queue page with actions
- [ ] Admin actions: hide post, hide comment, ban user
- [ ] **DETAILED:** Rate limiting via Upstash (see Part 19)
- [ ] **NEW:** Check banned status on every request
- [ ] Basic profanity filter (Romanian word list)
- [ ] **DETAILED:** Content sanitization (see Part 19)
- [ ] **NEW:** Admin audit logging
- [ ] **NEW:** User blocking/muting feature
- [ ] **NEW:** Address verification flow

**Key Files:**
- `lib/utils/sanitize.ts` (DETAILED)
- `middleware.ts` (ban check)
- `app/api/users/me/verify-address/route.ts` (NEW)

**Deliverable:** Users can report bad content. Admins can moderate with audit trail. Spam is limited. Users can block others.

---

### Phase 5: Polish & Preparation (Week 12-14) - UPDATED

**Goal:** Production-ready quality

**Tasks:**
- [ ] **DETAILED:** Error handling (user-friendly Romanian messages)
- [ ] Error boundary component
- [ ] **DETAILED:** Performance optimization:
  - [ ] Feed caching with Upstash Redis (document TTL, invalidation)
  - [ ] Image lazy loading with blur placeholder
  - [ ] Code splitting
- [ ] SEO meta tags
- [ ] Open Graph images
- [ ] Static pages: About, How it works
- [ ] Legal pages: Privacy policy, Terms of Service (GDPR compliant)
- [ ] **NEW:** GDPR data export endpoint
- [ ] Account deletion flow (GDPR)
- [ ] **NEW:** Automated testing setup
  - [ ] Unit tests with Vitest
  - [ ] E2E tests with Playwright
- [ ] Mobile testing (iOS Safari, Android Chrome)
- [ ] Accessibility audit
- [ ] **NEW:** Staging environment setup

**Key Files:**
- `lib/services/feed.service.ts` (caching strategy)
- `tests/**/*.ts` (NEW)
- `vitest.config.ts` (NEW)
- `playwright.config.ts` (NEW)

**Deliverable:** App feels polished, loads fast, handles errors gracefully, has legal pages, tested.

---

### Phase 6: Pilot Launch (Week 15-17) - UPDATED

**Goal:** Real users in Timișoara

**Tasks:**
- [ ] Add Timișoara neighborhoods to database
- [ ] Seed 15-20 real posts
- [ ] Create launch materials
- [ ] Marketing: Facebook groups, Instagram, flyers
- [ ] **NEW:** MVP-lite messaging for marketplace
- [ ] Talk to local businesses
- [ ] **DETAILED:** Monitor metrics daily (PostHog dashboards)
- [ ] Collect user feedback
- [ ] Fix critical bugs immediately
- [ ] Respond to user reports within 24 hours
- [ ] **NEW:** Iterate based on feedback

**Deliverable:** 100-200 real users in one Timișoara neighborhood, actively using the app.

---

## Summary of Changes (v2.0)

This updated development plan includes:

1. **Realistic Timeline** - Extended from 12 to 16-17 weeks
2. **Critical Gaps Identified** - Search, validation, error handling, image pipeline
3. **Additional Database Tables** - saved_posts, user_blocks, messages, address_verifications
4. **Missing API Endpoints** - Search, messaging, GDPR export, address verification
5. **Validation Schemas** - Complete Zod schemas for all forms
6. **Error Handling Strategy** - Custom error classes, Romanian messages
7. **Image Upload Pipeline** - Full implementation with Sharp
8. **Security Implementation** - Headers, rate limiting, ban checks, CORS
9. **CI/CD & DevOps** - GitHub Actions, migrations, monitoring
10. **Updated Project Structure** - All new files and folders
11. **Updated Development Phases** - Detailed tasks with new requirements

The goal remains: Ship to one neighborhood in Timișoara and validate that people actually use it before adding complexity.

---

**Ready to start? This plan now includes everything identified in the deep dive review. Begin with Phase 1.**

---

## Part 23: Development Workflow with Claude AI

This section provides a systematic approach to develop Vecinu across multiple coding sessions using Claude AI.

### The Golden Rule

**Always reference this file at the start of each session.** Claude will read it, understand the current state, and continue from where you left off.

**Always update this file after making code changes.** This keeps the documentation in sync with the actual codebase.

### Command Patterns

#### Starting a New Session
```
Read @DEVELOPMENT_PLAN.md and continue development from where we left off.
Check the current state of the codebase and complete the next unchecked tasks in the current phase.
After completing tasks, update Part 24 (Progress Tracker) with session details.
```

#### Starting a Specific Phase
```
@DEVELOPMENT_PLAN.md - Start Phase [X]. Check what's done, implement the next tasks.
Update the Progress Tracker when done.
```

#### Completing a Phase
```
@DEVELOPMENT_PLAN.md - Phase [X] is complete. Verify all deliverables work, then start Phase [X+1].
Update the Phase Completion Status table.
```

#### Fixing Issues
```
@DEVELOPMENT_PLAN.md - I'm in Phase [X]. [Describe the error].
Fix it, log the bug in Part 24, and continue.
```

#### Updating Documentation After Code Changes
```
Update @DEVELOPMENT_PLAN.md:
- Mark completed tasks with [x]
- Log this session in the Session Log
- Document any bugs in Bug Tracker
- Record decisions in Decision Log
- Summarize code changes in Code Changes Summary
```

### Session Workflow

**Before Coding:**
1. Open terminal/IDE
2. Reference this file: `@DEVELOPMENT_PLAN.md`
3. Tell Claude which phase/task to work on

**During Coding:**
1. Claude implements features
2. Test each feature before moving on
3. Commit working code frequently

**After Each Session (IMPORTANT):**
1. Ask Claude to update this file with:
   - ✅ Completed tasks (check the boxes)
   - 🐛 Any bugs encountered (add to Bug Tracker)
   - 📝 Decisions made (add to Decision Log)
   - 📁 Code changes summary (add to Code Changes Summary)
   - 📊 Update Current Status table

### Recommended Session Breakdown

#### Phase 1: Foundation (Sessions 1-4)
```
Session 1: "Initialize Next.js project, set up Supabase, configure Prisma schema, run migrations"
Session 2: "Set up Tailwind, shadcn/ui, create validation schemas and error handling"
Session 3: "Build auth pages (register, login, verify-email, password reset) with API routes"
Session 4: "Create app shell, navigation, neighborhood selection, deploy to Vercel, set up CI/CD"
```

#### Phase 2: Core Social (Sessions 5-10)
```
Session 5: "Implement post CRUD API with validation"
Session 6: "Build image upload service with Sharp as described in Part 18"
Session 7: "Create feed page with infinite scroll and category filtering"
Session 8: "Implement search API and UI with PostgreSQL full-text search"
Session 9: "Build threaded comments system"
Session 10: "Add saved posts functionality, implement rate limiting on posts/comments"
```

#### Phase 3: Notifications (Sessions 11-13)
```
Session 11: "Implement notifications API, database triggers, and bell component"
Session 12: "Set up Resend email service, create email templates, configure Inngest"
Session 13: "Build daily digest job, post expiry cleanup, notification retention (90 days)"
```

#### Phase 4: Moderation (Sessions 14-16)
```
Session 14: "Build report system API and admin dashboard layout"
Session 15: "Implement admin actions, rate limiting config, profanity filter"
Session 16: "Add user blocking/muting, address verification flow"
```

#### Phase 5: Polish (Sessions 17-20)
```
Session 17: "Implement feed caching with Redis, image lazy loading, code splitting"
Session 18: "Create legal pages (Privacy, Terms), GDPR data export, account deletion"
Session 19: "Set up Vitest for unit tests, Playwright for E2E tests"
Session 20: "Mobile testing, accessibility fixes, staging environment setup"
```

#### Phase 6: Launch (Sessions 21-22)
```
Session 21: "Seed Timișoara neighborhoods, create sample posts, implement MVP messaging"
Session 22: "Final testing, bug fixes, production deployment, launch preparation"
```

### Important Rules

1. **Always update this file** after making code changes
2. **Document decisions** - Why did we choose X over Y?
3. **Log all bugs** in the Bug Tracker section below
4. **Commit after each working feature** with descriptive messages
5. **Test before moving on** - Don't accumulate broken code
6. **Keep this file as the single source of truth**

### Quick Reference Commands

| Action | Command |
|--------|---------|
| Start fresh session | `Read @DEVELOPMENT_PLAN.md and continue from where we left off` |
| Specific task | `Implement [feature] as described in Part [X]` |
| Fix bug | `Fix: [error message]. Log in Bug Tracker. Then continue Phase [X]` |
| Update docs | `Update @DEVELOPMENT_PLAN.md Part 24 with today's progress` |
| Verify phase | `Verify all Phase [X] deliverables work correctly` |
| Commit code | `Commit changes with message: [description]` |
| Run tests | `Run all tests and fix any failures` |
| Deploy | `Deploy to [staging/production] and verify` |
| End session | `Update @DEVELOPMENT_PLAN.md with all changes from this session` |

---

## Part 24: Development Progress Tracker

**IMPORTANT:** Update this section after EVERY development session to maintain accurate project state.

### Current Status

| Field | Value |
|-------|-------|
| **Current Phase** | Phase 1: Foundation (In Progress) |
| **Current Session** | 1 |
| **Last Updated** | 2026-01-17 |
| **Last Completed Task** | Project initialization, folder structure, auth pages, API routes |
| **Next Task** | Set up Supabase project, run Prisma migrations, test app |
| **Blockers** | Node.js v18 has warnings for Supabase (requires v20+) - works but should upgrade |
| **Total Hours Spent** | ~3 |

### Phase Completion Status

| Phase | Status | Started | Completed | Sessions | Notes |
|-------|--------|---------|-----------|----------|-------|
| Phase 1: Foundation | 🟡 In Progress | 2026-01-17 | - | 1/4 | Project init done, auth pages created |
| Phase 2: Core Social | ⬜ Not Started | - | - | 0/6 | - |
| Phase 3: Notifications | ⬜ Not Started | - | - | 0/3 | - |
| Phase 4: Moderation | ⬜ Not Started | - | - | 0/3 | - |
| Phase 5: Polish | ⬜ Not Started | - | - | 0/4 | - |
| Phase 6: Launch | ⬜ Not Started | - | - | 0/2 | - |

**Status Legend:** ⬜ Not Started | 🟡 In Progress | ✅ Complete | 🔴 Blocked

---

### Session Log

Record each development session here:

| Session | Date | Phase | Tasks Completed | Hours | Notes |
|---------|------|-------|-----------------|-------|-------|
| 1 | 2026-01-17 | Phase 1 | Project init, folder structure, UI components, auth pages, API routes, Prisma schema | ~3 | Dark mode UI, clean design, Romanian labels |
| 2 | - | - | - | - | - |
| 3 | - | - | - | - | - |
| 4 | - | - | - | - | - |
| 5 | - | - | - | - | - |

*(Add more rows as needed)*

---

### Bug Tracker

Track all bugs encountered during development:

| ID | Date | Phase | Description | Severity | Status | Resolution | Session Fixed |
|----|------|-------|-------------|----------|--------|------------|---------------|
| BUG-001 | - | - | - | - | - | - | - |

**Severity:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low
**Status:** 🔴 Open | 🟡 In Progress | ✅ Fixed | ⬜ Won't Fix

---

### Decision Log

Document important technical decisions:

| ID | Date | Decision | Reasoning | Alternatives Considered | Session |
|----|------|----------|-----------|------------------------|---------|
| DEC-001 | 2026-01-17 | Custom UI components instead of shadcn/ui | Clean, minimal dark mode look per user request | shadcn/ui copy-paste | 1 |
| DEC-002 | 2026-01-17 | Next.js 14.2.35 | Security patch required for vulnerability | 14.2.21 (vulnerable) | 1 |
| DEC-003 | 2026-01-17 | Dark mode by default | User requested clean dark interface | Light mode default | 1 |
| DEC-004 | 2026-01-17 | All UI text in Romanian | Target market is Romania | English with translations | 1 |

---

### Code Changes Summary

Track major code changes by session:

| Session | Date | Files Created | Files Modified | Key Changes |
|---------|------|---------------|----------------|-------------|
| 1 | 2026-01-17 | 40+ | 0 | Full project init: package.json, tsconfig, tailwind, prisma schema, UI components, auth pages, API routes, middleware |
| 2 | - | - | - | - |
| 3 | - | - | - | - |

---

### API Endpoints Implemented

Track which endpoints are done:

| Endpoint | Method | Status | Session | Notes |
|----------|--------|--------|---------|-------|
| `/api/auth/register` | POST | 🟡 | 1 | Created, needs Supabase for full test |
| `/api/auth/login` | POST | 🟡 | 1 | Created, needs Supabase for full test |
| `/api/auth/logout` | POST | ⬜ | - | - |
| `/api/auth/verify-email` | POST | ⬜ | - | - |
| `/api/auth/forgot-password` | POST | ⬜ | - | - |
| `/api/auth/reset-password` | POST | ⬜ | - | - |
| `/api/auth/me` | GET | 🟡 | 1 | Created, needs Supabase for full test |
| `/api/posts` | GET | ⬜ | - | - |
| `/api/posts` | POST | ⬜ | - | - |
| `/api/posts/:id` | GET | ⬜ | - | - |
| `/api/posts/:id` | PATCH | ⬜ | - | - |
| `/api/posts/:id` | DELETE | ⬜ | - | - |
| `/api/search` | GET | ⬜ | - | - |
| `/api/posts/:id/comments` | GET | ⬜ | - | - |
| `/api/posts/:id/comments` | POST | ⬜ | - | - |
| `/api/notifications` | GET | ⬜ | - | - |
| `/api/reports` | POST | ⬜ | - | - |
| `/api/admin/reports` | GET | ⬜ | - | - |

*(See Part 4 and Part 15 for full endpoint list)*

---

### Components Implemented

Track UI components:

| Component | Location | Status | Session | Notes |
|-----------|----------|--------|---------|-------|
| Button | `components/ui/` | ✅ | 1 | Custom with variants, loading state |
| Card | `components/ui/` | ✅ | 1 | Custom with Header, Content, Footer |
| Input | `components/ui/` | ✅ | 1 | Custom with error display |
| Textarea | `components/ui/` | ✅ | 1 | Custom with error display |
| Avatar | `components/ui/` | ✅ | 1 | Custom with image fallback |
| Badge | `components/ui/` | ✅ | 1 | Custom with color variants |
| Skeleton | `components/ui/` | ✅ | 1 | Custom loading placeholder |
| PostCard | `components/feed/` | ⬜ | - | - |
| PostList | `components/feed/` | ⬜ | - | - |
| PostForm | `components/feed/` | ⬜ | - | - |
| ImageUpload | `components/feed/` | ⬜ | - | - |
| CommentList | `components/comments/` | ⬜ | - | - |
| AppShell | `components/layout/` | ⬜ | - | - |
| Header | `components/layout/` | ⬜ | - | - |
| MobileNav | `components/layout/` | ⬜ | - | - |
| NotificationBell | `components/layout/` | ⬜ | - | - |

---

### Environment Setup Checklist

Track external service setup:

**Repository & Hosting:**
- [ ] GitHub repository created
- [ ] Vercel project created
- [ ] Vercel connected to GitHub
- [ ] Custom domain configured (vecinu.ro)
- [ ] SSL certificate active

**Supabase:**
- [ ] Supabase project created
- [ ] Database schema applied
- [ ] Auth configured (email/password)
- [ ] Storage bucket created (`post-images`)
- [ ] Row Level Security policies set

**External Services:**
- [ ] Resend account created
- [ ] Resend API key in env
- [ ] Resend domain verified
- [ ] Upstash Redis created
- [ ] Upstash credentials in env
- [ ] Inngest account created
- [ ] Inngest keys in env
- [ ] Sentry project created
- [ ] Sentry DSN in env
- [ ] PostHog/Plausible configured

**Environment Variables Set:**
- [x] `.env.local` created (template with placeholder values)
- [x] `.env.example` created (for reference)
- [ ] Vercel Preview env vars
- [ ] Vercel Production env vars
- [ ] GitHub Secrets for CI/CD

---

### Deployment History

| Date | Version | Environment | Status | Commit | Notes |
|------|---------|-------------|--------|--------|-------|
| - | v0.1.0 | - | - | - | Initial deployment |

---

### Test Coverage

| Area | Unit Tests | Integration | E2E | Coverage % | Session |
|------|------------|-------------|-----|------------|---------|
| Auth | 0 | 0 | 0 | 0% | - |
| Posts | 0 | 0 | 0 | 0% | - |
| Comments | 0 | 0 | 0 | 0% | - |
| Notifications | 0 | 0 | 0 | 0% | - |
| Admin | 0 | 0 | 0 | 0% | - |
| **Total** | 0 | 0 | 0 | 0% | - |

---

### Performance Metrics

Track after deployment:

| Metric | Target | Current | Status | Last Checked |
|--------|--------|---------|--------|--------------|
| Feed load time | < 2s | - | ⬜ | - |
| Time to Interactive | < 3s | - | ⬜ | - |
| Lighthouse Performance | > 80 | - | ⬜ | - |
| Lighthouse Accessibility | > 90 | - | ⬜ | - |
| Lighthouse SEO | > 90 | - | ⬜ | - |

---

### Known Issues / Technical Debt

Track issues to address later:

| ID | Description | Priority | Phase to Fix | Notes |
|----|-------------|----------|--------------|-------|
| - | - | - | - | - |

---

### Notes & Reminders

- Remember to update this file after EVERY session
- Always test on mobile before completing a phase
- Keep Romanian language consistent (check diacritics: ă, â, î, ș, ț)
- Back up database before major migrations
- Don't forget to rotate API keys quarterly
- Check Supabase free tier limits regularly

---

## Quick Start Guide

### First Time Setup (Day 1)

1. [ ] Open terminal in project directory (`d:\m-vecinu`)
2. [ ] Start Claude AI session
3. [ ] Say the following:

```
Read @DEVELOPMENT_PLAN.md and begin Phase 1: Foundation.
Initialize the Next.js 14 project with TypeScript.
Follow the project structure in Part 21.
After setup, update Part 24 (Progress Tracker) with:
- Current Status table
- Session Log entry
- Code Changes Summary
```

4. [ ] Let Claude create the project
5. [ ] Verify the app runs (`npm run dev`)
6. [ ] Verify this file was updated
7. [ ] Commit to GitHub

### Template for Daily Sessions

Copy and paste this at the start of each session:

```
Read @DEVELOPMENT_PLAN.md

Current Status from Part 24:
- Phase: [check the table]
- Last session: [check Session Log]
- Next task: [check Current Status]

Continue development. Complete the next tasks in the current phase.

IMPORTANT: Before ending this session, update Part 24 with:
1. Current Status table (new values)
2. Session Log (add new row)
3. Any bugs found (Bug Tracker)
4. Code changes made (Code Changes Summary)
5. Check off completed tasks in Part 22
```

### End of Session Checklist

Before closing each session, ensure:

- [ ] All code changes are committed
- [ ] Part 24 Current Status is updated
- [ ] New Session Log entry added
- [ ] Any bugs logged in Bug Tracker
- [ ] Decisions documented in Decision Log
- [ ] Code Changes Summary updated
- [ ] Tasks checked off in Part 22
- [ ] App still runs without errors

---

**Your first command:**

```
Read @DEVELOPMENT_PLAN.md and begin Phase 1: Foundation.
Initialize the Next.js 14 project with TypeScript in this directory.
Set up the folder structure as defined in Part 21.
After completing, update Part 24 (Development Progress Tracker) with all session details.
```
