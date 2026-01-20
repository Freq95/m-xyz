# Vecinu Development Rules

Version: 1.0
Last Updated: 2026-01-19

---

## API Route Pattern

All API routes MUST follow this structure:

```typescript
// src/app/api/[resource]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma/client';
import { validateOrigin } from '@/lib/csrf';
import { handleApiError } from '@/lib/errors/handler';
import { AuthorizationError } from '@/lib/errors';
import { resourceSchema } from '@/lib/validations/resource';

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF check (all POST/PATCH/DELETE)
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    // 2. Authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new AuthorizationError('Neautorizat');
    }

    // 3. Validation
    const body = await request.json();
    const validated = resourceSchema.parse(body);

    // 4. Business logic
    const result = await prisma.resource.create({
      data: { ...validated, authorId: user.id }
    });

    // 5. Response
    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## Validation Schemas

Location: `src/lib/validations/[resource].ts`

```typescript
import { z } from 'zod';

export const postSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
  category: z.enum(['ALERT', 'SELL', 'BUY', 'SERVICE', 'QUESTION', 'EVENT']),
  priceCents: z.number().int().positive().optional(),
});

export type PostInput = z.infer<typeof postSchema>;
```

---

## Error Classes

Use custom errors from `src/lib/errors/index.ts`:

| Class | Status | Usage |
|-------|--------|-------|
| `ValidationError` | 400 | Invalid input |
| `AuthorizationError` | 401 | Not authenticated |
| `ForbiddenError` | 403 | Not allowed |
| `NotFoundError` | 404 | Resource not found |
| `ConflictError` | 409 | Already exists |
| `RateLimitError` | 429 | Too many requests |
| `InternalServerError` | 500 | Server error |

---

## Romanian Messages

All user-facing text MUST be in Romanian:

```typescript
// ✅ Good
throw new ValidationError('Adresa de email este invalidă');

// ❌ Bad
throw new ValidationError('Invalid email address');
```

---

## Security Requirements

### CSRF Protection
- ALL POST/PATCH/DELETE routes MUST call `validateOrigin(request)`
- GET routes do NOT need CSRF

### Rate Limiting (Optional)
- Auth endpoints: 5 requests / 15 minutes
- Post creation: 10 posts / hour
- Rate limiting gracefully degrades if packages not installed

### XSS Prevention
- User-generated content MUST be sanitized with DOMPurify
- NEVER use `dangerouslySetInnerHTML` without sanitization

### Database
- ALWAYS use Prisma (parameterized queries)
- NEVER construct raw SQL strings
- Use `prisma.$transaction()` for multi-step operations

---

## Client-Side Fetching

Use `fetchWithTimeout` from `src/lib/fetch.ts`:

```typescript
import { fetchWithTimeout } from '@/lib/fetch';

const response = await fetchWithTimeout('/api/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
  timeout: 30000, // 30 seconds
});
```

---

## File Structure

```
src/
  app/
    api/[resource]/route.ts    # API endpoints
    (auth)/[page]/page.tsx     # Public auth pages
    (main)/[page]/page.tsx     # Protected pages
  lib/
    validations/[schema].ts    # Zod schemas
    errors/index.ts            # Error classes
    errors/handler.ts          # handleApiError
    csrf.ts                    # CSRF validation
    fetch.ts                   # fetchWithTimeout
    supabase/client.ts         # Browser client
    supabase/server.ts         # Server client
  components/
    ui/                        # shadcn/ui components
```

---

## Git Conventions

### Commit Messages
```
[PHASE]-[TYPE]: Brief description

Examples:
P2-feat: Add post creation API
P2-fix: Handle empty body validation
P2-refactor: Extract post service
```

### Before Committing
```bash
npm run build     # Must pass
npx tsc --noEmit  # Must pass
```

---

## Review Checklist

Before marking any task complete:

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes (0 errors)
- [ ] Feature works end-to-end (manual test)
- [ ] Error cases handled
- [ ] CSRF protection on POST routes
- [ ] Romanian error messages
- [ ] CLAUDE.md updated

---

## Reference Files

For more context:
- `docs/PLAN.md` - Full development plan, phase requirements
- `TESTING_AUTH.md` - How to test auth flow
- `docs/archive/phase1-review.md` - Phase 1 security fixes

---

*These rules are mandatory. Do not deviate without discussion.*
