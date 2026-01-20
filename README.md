# Vecinu - Hyper-Local Neighborhood Network

A social network connecting neighbors in Romanian cities. Starting with Timișoara pilot.

**Status:** ✅ Phase 1 Complete (100%)

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [PROGRESS.md](PROGRESS.md) | **Start here** - Current status, what's done, what's next |
| [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) | Overall strategy, tech stack, roadmap |
| [cursor.md](cursor.md) | Detailed session history & technical decisions |
| [TESTING_AUTH.md](TESTING_AUTH.md) | How to test authentication flow |
| [OPTIONAL_DEPENDENCIES.md](OPTIONAL_DEPENDENCIES.md) | Optional packages (Upstash, Resend) |
| [CURSOR_REVIEW_WORKFLOW.md](CURSOR_REVIEW_WORKFLOW.md) | Quality control process |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (20+ recommended)
- Supabase account
- PostgreSQL database (via Supabase)

### Setup

1. **Clone and install:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   # Copy template
   cp .env.example .env.local

   # Fill in your Supabase credentials:
   # - NEXT_PUBLIC_SUPABASE_URL
   # - NEXT_PUBLIC_SUPABASE_ANON_KEY
   # - DATABASE_URL (Session Pooler format)
   ```

3. **Initialize database:**
   ```bash
   npm run db:push
   npm run db:generate
   ```

4. **Start development:**
   ```bash
   npm run dev
   ```

5. **Open:** http://localhost:3000

---

## 🧪 Testing

### Manual Testing
```bash
# Test auth flow
npm run dev
# Then go to /register, create account, verify email, login

# Check database
npm run db:studio
# Opens visual database browser at localhost:5555
```

### Check Connection
```bash
node check-supabase.js
# Verifies Supabase Auth and Database are connected
```

See [TESTING_AUTH.md](TESTING_AUTH.md) for detailed testing guide.

---

## 📦 Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Database:** PostgreSQL (Supabase)
- **ORM:** Prisma
- **Auth:** Supabase Auth
- **Styling:** Tailwind CSS + shadcn/ui
- **Hosting:** Vercel (planned)

**Optional:**
- Rate limiting: Upstash Redis
- Email: Resend (Supabase handles verification emails)

See [OPTIONAL_DEPENDENCIES.md](OPTIONAL_DEPENDENCIES.md) for details.

---

## ✅ What's Working (Phase 1 Complete)

- ✅ User registration (Supabase Auth)
- ✅ Email verification (automatic)
- ✅ Login/logout (session management)
- ✅ Database schema (7 tables)
- ✅ Input validation (Zod)
- ✅ Error handling (Romanian messages)
- ✅ Rate limiting (optional - Upstash)
- ✅ Neighborhood selection onboarding
- ✅ Feed page with navigation

## 🔴 What's Next (Phase 2)

1. Post creation with categories
2. Image upload (Supabase Storage)
3. Comments system
4. XSS sanitization
5. Deployment to Vercel

See [PROGRESS.md](PROGRESS.md) for full status.

---

## 📁 Project Structure

```
vecinu/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/auth/       # Authentication endpoints
│   │   ├── auth/           # Auth pages & callback
│   │   ├── (auth)/         # Public auth pages
│   │   └── (dashboard)/    # Protected pages
│   ├── components/         # React components
│   ├── lib/                # Utilities
│   │   ├── prisma/        # Database client
│   │   ├── supabase/      # Supabase clients
│   │   ├── validations/   # Zod schemas
│   │   ├── errors/        # Error classes
│   │   └── rate-limit.ts  # Rate limiting
│   └── middleware.ts       # Auth middleware
├── prisma/
│   └── schema.prisma       # Database schema
├── public/                 # Static assets
└── docs/                   # (Documentation above)
```

---

## 🛠️ Available Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run db:push          # Push schema to database
npm run db:generate      # Generate Prisma client
npm run db:studio        # Open Prisma Studio
npm run db:migrate       # Create migration

# Testing
node check-supabase.js   # Check DB connection
```

---

## 🤝 Development Workflow

### Working with Multiple AI Tools

This project uses both **Claude Code** and **Cursor AI**. To maintain quality:

1. **After each Cursor session:** Document in `cursor.md`
2. **Before new Claude session:** Review last Cursor session
3. **Always:** Run tests, check TypeScript errors
4. **See:** [CURSOR_REVIEW_WORKFLOW.md](CURSOR_REVIEW_WORKFLOW.md)

---

## 📝 Session History

- **Session 3 (2026-01-18):** Completed Phase 1 - feed page, neighborhood selection, bug fixes
- **Session 2 (2026-01-18):** Fixed authentication architecture, added rate limiting
- **Session 1 (2026-01-17):** Initial database setup

See [cursor.md](cursor.md) for detailed logs.

---

## 🎯 Project Goals

**MVP Goal:** Connect neighbors in one Timișoara neighborhood
- Users can post alerts, questions, marketplace items
- Verified by address (prevents spam)
- Romanian-first experience
- Free to use (ads later)

**Launch Target:** 16-18 weeks
**Current Progress:** Week 1, Phase 1 Complete ✅

---

## 📄 License

Private project - Not open source

---

**Questions?** Check [PROGRESS.md](PROGRESS.md) for current status or [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for detailed roadmap.
