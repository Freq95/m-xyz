MVP Blocker Fixes - Implementation Plan
Total Estimated Time: 26-28 hours
Status: Ready for approval and implementation

Overview
This plan addresses critical MVP blockers identified in the comprehensive 5-pillar audit. Priority is legal compliance (GDPR), then operational monitoring, then UX/accessibility.

Critical Gaps Summary:

🔴 Legal Risk: No Privacy/Terms pages, no GDPR export/deletion (€20M fine risk)
🟡 Operations: No error tracking (blind in production), email not integrated, admin cache bugs
🟡 UX/Accessibility: Missing ARIA labels, native confirm() dialogs, no Escape key support
Phase 1: GDPR Compliance (Legal Blocker - HIGHEST PRIORITY)
Duration: 12-14 hours
Goal: Eliminate legal risk and achieve GDPR compliance

1.1 Legal Pages (3 hours)
Create 3 public pages following settings page pattern:


src/app/(main)/privacy/page.tsx
src/app/(main)/terms/page.tsx
src/app/(main)/about/page.tsx
Pattern to follow:

Copy layout from src/app/(main)/settings/page.tsx (ArrowLeft back button, Card components)
Max-width container (max-w-4xl) with prose styling
Romanian language throughout
Content requirements:

Privacy: Data collection, usage, sharing, cookies, GDPR rights (export, deletion), contact
Terms: User responsibilities, content policy, prohibited content, liability, dispute resolution
About: Mission, how Vecinu works, team info, support contact
Verification:

Navigate to /privacy, /terms, /about
Check responsive layout on mobile
Verify back button works
Check homepage footer links work
1.2 GDPR Data Export API (4-5 hours)
Files to create:


src/lib/services/gdpr.service.ts
src/app/api/user/export/route.ts
Implementation:

gdpr.service.ts - Aggregate all user data:


export async function exportUserData(userId: string) {
  // Fetch all user data in parallel
  const [user, posts, comments, savedPosts, notifications, reports] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          fullName: true,
          displayName: true,
          bio: true,
          notificationPreferences: true,
          createdAt: true,
          updatedAt: true,
          neighborhood: { select: { name: true, slug: true } }
        }
      }),
      prisma.post.findMany({ where: { authorId: userId } }),
      prisma.comment.findMany({ where: { authorId: userId } }),
      prisma.savedPost.findMany({ where: { userId }, include: { post: true } }),
      prisma.notification.findMany({ where: { userId } }),
      prisma.report.findMany({ where: { reporterId: userId } })
    ]);

  return {
    exportDate: new Date().toISOString(),
    user,
    posts,
    comments,
    savedPosts,
    notifications,
    reports
  };
}
route.ts - Follow pattern from src/app/api/user/settings/route.ts:

Use getAuthUser() for authentication
Use validateOrigin() for CSRF protection
Return JSON with Content-Disposition: attachment header
Add rate limiting (10 exports/hour using existing rate-limit pattern)
Security:

Only export data belonging to authenticated user
Don't include password hash
Include export timestamp and metadata
Verification:

Authenticated user can GET /api/user/export
Response downloads as JSON file
All user data models included
Rate limit triggers after 10 requests
1.3 Account Deletion Flow (5-6 hours)
Files to create:


src/components/settings/delete-account-modal.tsx
src/app/api/user/delete/route.ts
Files to modify:


src/app/(main)/settings/page.tsx (add Delete Account section)
Implementation:

delete-account-modal.tsx - Custom confirmation modal (NOT native confirm):


export function DeleteAccountModal({ isOpen, onClose, onConfirm }: Props) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Require typing "DELETE" to confirm
  const canDelete = confirmText === 'DELETE';

  // Add Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-destructive">Șterge contul</h2>
        <p className="text-sm text-destructive mb-4">
          Această acțiune este PERMANENTĂ și nu poate fi anulată.
        </p>
        <ul className="text-sm mb-4">
          <li>✓ Toate postările tale vor fi șterse</li>
          <li>✓ Toate comentariile tale vor fi șterse</li>
          <li>✓ Contul tău va fi dezactivat permanent</li>
        </ul>
        <Input
          placeholder="Scrie DELETE pentru confirmare"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
        />
        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Anulează
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!canDelete || isDeleting}
            isLoading={isDeleting}
          >
            Șterge contul permanent
          </Button>
        </div>
      </Card>
    </div>
  );
}
route.ts - API deletion logic (soft delete + anonymization):


export async function POST(request: NextRequest) {
  // 1. Auth + CSRF check
  const user = await getAuthUser();
  if (!validateOrigin(request)) {
    throw new ValidationError('Cerere invalidă');
  }

  // 2. Soft delete user (GDPR compliant - preserves legal data)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isBanned: true,
      bannedReason: 'Account deleted by user',
      email: `deleted_${user.id}@deleted.com`,
      displayName: 'Cont șters',
      bio: null,
      avatarUrl: null,
      notificationPreferences: {}
    }
  });

  // 3. Delete sensitive personal data
  await Promise.all([
    prisma.notification.deleteMany({ where: { userId: user.id } }),
    prisma.savedPost.deleteMany({ where: { userId: user.id } })
  ]);

  // 4. Anonymize content (keep for context)
  await Promise.all([
    prisma.post.updateMany({
      where: { authorId: user.id },
      data: { status: 'deleted' }
    }),
    prisma.comment.updateMany({
      where: { authorId: user.id },
      data: { status: 'deleted', body: '[șters]' }
    })
  ]);

  // 5. Sign out
  const supabase = await createClient();
  await supabase.auth.signOut();

  return successResponse({ message: 'Contul a fost șters' });
}
settings/page.tsx - Add danger zone section at bottom:


{/* Danger Zone - at the very bottom */}
<Card className="p-6 border-destructive/50">
  <h2 className="text-lg font-semibold text-destructive mb-4">
    Zona Periculoasă
  </h2>
  <p className="text-sm text-muted-foreground mb-4">
    Odată ce îți ștergi contul, nu mai există cale de întoarcere.
    Te rugăm să fii sigur.
  </p>
  <Button
    variant="destructive"
    onClick={() => setShowDeleteModal(true)}
  >
    Șterge contul permanent
  </Button>
</Card>

{/* Delete Account Modal */}
<DeleteAccountModal
  isOpen={showDeleteModal}
  onClose={() => setShowDeleteModal(false)}
  onConfirm={handleDeleteAccount}
/>
Verification:

Delete Account section appears at bottom of settings
Clicking opens custom modal (NOT native confirm)
Modal requires typing "DELETE" to enable button
After deletion: user logged out, redirected to homepage
Check database: user anonymized, posts/comments show "[șters]"
Verify cascade: notifications and savedPosts deleted
Phase 2: Operational Infrastructure
Duration: 8-10 hours
Goal: Enable production monitoring and fix critical operational bugs

2.1 Sentry Integration (3-4 hours)
Files to create:


src/lib/monitoring/sentry.ts
sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts
Files to modify:


src/app/error.tsx (line 24 - replace TODO)
src/components/shared/error-boundary.tsx (line 38 - replace TODO)
package.json (add @sentry/nextjs)
Implementation:

Install Sentry:


npm install --save @sentry/nextjs
sentry.client.config.ts:


import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,

  beforeSend(event) {
    // Filter out known noise
    if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
      return null;
    }
    return event;
  }
});
error.tsx (line 24):


// Replace TODO with:
if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
  import('@sentry/nextjs').then(Sentry => {
    Sentry.captureException(error, {
      tags: { errorDigest: error.digest }
    });
  });
}
error-boundary.tsx (line 38):


componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  console.error('Error Boundary caught:', error, errorInfo);

  // Send to Sentry in production
  if (typeof window !== 'undefined') {
    import('@sentry/nextjs').then(Sentry => {
      Sentry.captureException(error, {
        contexts: {
          react: { componentStack: errorInfo.componentStack }
        }
      });
    });
  }
}
Environment variables:


NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=... # For source maps
Verification:

Trigger error in production build
Check Sentry dashboard for error event
Verify source maps work (readable stack traces)
Confirm breadcrumbs capture user actions
2.2 Health Endpoint (1 hour)
Files to create:


src/app/api/health/route.ts
Implementation:


import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma/client';
import { redis } from '@/lib/redis/client';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    }
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.services.database = 'healthy';
  } catch {
    checks.services.database = 'unhealthy';
    checks.status = 'degraded';
  }

  try {
    if (redis) {
      await redis.ping();
      checks.services.redis = 'healthy';
    } else {
      checks.services.redis = 'disabled';
    }
  } catch {
    checks.services.redis = 'unhealthy';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
Verification:

curl http://localhost:3000/api/health returns 200
Response includes database and redis status
Stop database, verify endpoint returns 503
Response time < 100ms
2.3 Admin Cache Invalidation Fix (1 hour)
Files to modify:


src/app/api/admin/posts/[id]/route.ts (add cache invalidation after line 47)
Implementation:


// After line 47 in route.ts
let post;
if (data.action === 'hide') {
  post = await hidePost(admin.id, id, data.reason);
} else {
  post = await unhidePost(admin.id, id);
}

// ADD: Invalidate feed cache
if (redis && post.neighborhoodId) {
  await invalidateFeedCache(post.neighborhoodId).catch(err => {
    console.error('Failed to invalidate feed cache:', err);
  });
}

return successResponse({ post });
Pattern reference:

Import invalidateFeedCache from src/lib/redis/client.ts
Copy pattern from src/app/api/posts/route.ts (line ~100)
Verification:

Admin hides a post
Feed refreshes immediately (no 15min stale cache)
No errors in logs if Redis unavailable
2.4 Resend Email Integration (4-5 hours)
Files to create:


src/lib/email/client.ts
src/lib/email/templates/comment-notification.tsx
Files to modify:


src/lib/services/notification.service.ts (add email sending after line 76)
Install dependencies:


npm install react-email @react-email/components
Implementation:

email/client.ts:


import { Resend } from 'resend';

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  if (!resend) {
    console.warn('Resend not configured, skipping email');
    return null;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Vecinu <noreply@vecinu.ro>',
      to,
      subject,
      react,
    });

    if (error) {
      console.error('Failed to send email:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Email send error:', error);
    return null;
  }
}
templates/comment-notification.tsx:


import {
  Body, Container, Head, Html, Preview, Text, Button, Section
} from '@react-email/components';

export default function CommentNotificationEmail({
  userName,
  commenterName,
  postTitle,
  postUrl,
}: {
  userName: string;
  commenterName: string;
  postTitle: string;
  postUrl: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{commenterName} a comentat la postarea ta</Preview>
      <Body style={{ backgroundColor: '#f6f9fc', fontFamily: 'Arial' }}>
        <Container style={{ margin: '0 auto', padding: '20px', maxWidth: '600px' }}>
          <Text style={{ fontSize: '16px' }}>Salut {userName},</Text>
          <Text>{commenterName} a comentat la postarea ta:</Text>
          <Section style={{ padding: '10px', backgroundColor: '#fff' }}>
            <Text style={{ fontWeight: 'bold' }}>{postTitle}</Text>
          </Section>
          <Button
            href={postUrl}
            style={{
              backgroundColor: '#000',
              color: '#fff',
              padding: '12px 20px',
              borderRadius: '5px',
              textDecoration: 'none'
            }}
          >
            Vezi comentariul
          </Button>
          <Text style={{ color: '#999', fontSize: '12px' }}>
            Vecinu - Comunitatea ta de cartier
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
notification.service.ts (after line 76):


// After creating in-app notification
const notification = await createNotification({...});

// ADD: Send email notification
const user = await prisma.user.findUnique({
  where: { id: postAuthorId },
  select: {
    email: true,
    displayName: true,
    fullName: true,
    notificationPreferences: true
  }
});

const prefs = user?.notificationPreferences as { email_comments?: boolean } | null;

if (prefs?.email_comments !== false && user?.email) {
  sendEmail({
    to: user.email,
    subject: title,
    react: CommentNotificationEmail({
      userName: user.displayName || user.fullName,
      commenterName,
      postTitle: postTitle || 'Postarea ta',
      postUrl: `${process.env.NEXT_PUBLIC_APP_URL}/post/${postId}`
    })
  }).catch(err => {
    console.error('Failed to send email:', err);
    // Don't throw - email failure shouldn't block notification
  });
}

return notification;
Environment variables:


RESEND_API_KEY=re_...
NEXT_PUBLIC_APP_URL=https://vecinu.ro
Verification:

Comment on a post
Check email inbox for notification
Verify email respects user preferences (email_comments)
Test with Resend disabled (graceful fallback)
Check email template renders correctly
Phase 3: UX & Accessibility
Duration: 4-5 hours
Goal: Fix critical accessibility issues and improve UX polish

3.1 Add aria-labels to Icon Buttons (1 hour)
Files to modify:


src/app/(main)/feed/page.tsx (Refresh and Settings buttons)
src/components/layout/notification-bell.tsx (Bell button)
src/components/feed/post-card.tsx (PostCardMenu and SaveButton)
Changes:

Refresh button (feed/page.tsx ~line 179):

<Button
  variant="ghost"
  size="sm"
  onClick={handleRefresh}
  aria-label="Reîmprospătează feed-ul"
>
  <RefreshCw className="w-4 h-4" />
</Button>
Settings button (feed/page.tsx ~line 184):

<Link href="/settings">
  <Button variant="ghost" size="sm" aria-label="Deschide setările">
    <Settings className="w-4 h-4" />
  </Button>
</Link>
NotificationBell (notification-bell.tsx ~line 134):

<Button
  variant="ghost"
  size="sm"
  className="relative"
  onClick={() => setIsOpen(!isOpen)}
  aria-label={`Notificări${unreadCount > 0 ? ` (${unreadCount} necitite)` : ''}`}
>
  <Bell className="w-5 h-5" />
  {/* ... badge ... */}
</Button>
PostCardMenu (post-card.tsx ~line 277):

<Button
  variant="ghost"
  size="sm"
  onClick={() => setShowMenu(!showMenu)}
  aria-label="Opțiuni postare (Share, Report)"
>
  <MoreHorizontal className="w-4 h-4" />
</Button>
SaveButton (post-card.tsx ~line 408):

<button
  onClick={handleSave}
  disabled={isLoading}
  className="..."
  title={isSaved ? 'Șterge din salvate' : 'Salvează postarea'}
  aria-label={isSaved ? 'Șterge din salvate' : 'Salvează postarea'}
>
  {/* ... */}
</button>
Verification:

Tab through page - focus visible on all buttons
Screen reader announces button purpose correctly
All icon-only buttons have descriptive labels
3.2 Replace Native confirm() with Custom Modals (2-3 hours)
Files to create:


src/components/shared/confirm-modal.tsx
Files to modify:


src/app/(main)/post/[id]/page.tsx (replace 4 confirm() calls)
src/components/shared/index.ts (add export)
Implementation:

confirm-modal.tsx:


interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: 'default' | 'destructive';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmă',
  confirmVariant = 'default',
  isLoading = false
}: ConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Auto-focus confirm button
  useEffect(() => {
    if (isOpen) {
      confirmButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <Card
        className="max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-2">{title}</h2>
        <p className="text-muted-foreground mb-6">{message}</p>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Anulează
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isLoading}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </Card>
    </div>
  );
}
post/[id]/page.tsx - Replace 4 confirm() calls:


// Add state
const [deletePostModal, setDeletePostModal] = useState(false);
const [deleteCommentModal, setDeleteCommentModal] = useState<string | null>(null);

// Before (line 275):
if (!confirm('Sigur vrei să ștergi această postare?')) return;

// After:
// In JSX at bottom:
<ConfirmModal
  isOpen={deletePostModal}
  onClose={() => setDeletePostModal(false)}
  onConfirm={handleDeleteConfirmed}
  title="Șterge postarea"
  message="Sigur vrei să ștergi această postare? Această acțiune nu poate fi anulată."
  confirmText="Șterge"
  confirmVariant="destructive"
  isLoading={isDeleting}
/>

// In delete button onClick:
onClick={() => setDeletePostModal(true)}
Repeat for all 4 confirm() locations (delete post, delete comment, mark sold, hide post).

Verification:

All modals appear centered with overlay
Escape key closes modal
Click outside closes modal
Loading state disables buttons
No confirm() or alert() calls remain
3.3 Improve Image Alt Text (30 min)
Files to modify:


src/components/feed/post-card.tsx (line 148)
Change:


// Before:
<Image
  src={image.thumbnailUrl || image.url}
  alt=""
  fill
  className="object-cover"
/>

// After:
<Image
  src={image.thumbnailUrl || image.url}
  alt={`Imagine postare: ${post.title || post.body.substring(0, 50)}`}
  fill
  className="object-cover"
/>
Verification:

Screen reader announces image description
Alt text appears on image load failure
No empty alt="" attributes remain
Phase 4: Testing & Verification
Duration: 2-3 hours
Goal: Comprehensive end-to-end testing

4.1 GDPR Flow Testing (1 hour)
Test Cases:

Export user data:

Login as user
Navigate to /api/user/export
Verify JSON downloads with all data models
Test rate limit (10 exports/hour)
Delete account:

Navigate to Settings → Delete Account
Verify modal requires typing "DELETE"
Confirm deletion
Verify user logged out and redirected
Check database: user anonymized, posts/comments show "[șters]"
Legal pages:

Navigate to /privacy, /terms, /about
Check responsive layout
Verify footer links work
4.2 Email Sending Testing (30 min)
Test Cases:

Comment notification email:

User A comments on User B's post
Check User B's email inbox
Verify email respects notification preferences
Email preferences:

Disable email_comments in settings
Comment on user's post
Verify no email sent (in-app notification still created)
Resend disabled:

Unset RESEND_API_KEY
Comment on post
Verify graceful fallback (warning logged, no error)
4.3 Accessibility Testing (30 min)
Test Cases:

Screen reader test:

Navigate feed with screen reader (NVDA/JAWS)
Verify all buttons announced correctly
Check image alt text read aloud
Keyboard navigation:

Tab through entire page
Verify focus visible on all elements
Test Escape key closes modals
Modal accessibility:

Open delete account modal
Verify focus trapped in modal
Escape key closes modal
Focus returns to trigger button
4.4 Full Build Verification (30 min)
Commands:


# TypeScript check
npx tsc --noEmit

# Build production
npm run build

# Start production server
npm start

# Test key flows:
# - Login → Settings → Delete Account
# - Comment on post → Check email
# - Admin hide post → Check feed cache
# - Navigate to /health, /privacy, /terms
Acceptance Criteria:

No TypeScript errors
No build errors
Production build runs without errors
All MVP features working
Critical Files Reference
Phase 1 (GDPR):

src/app/(main)/settings/page.tsx - Pattern for legal pages and delete UI
src/lib/services/admin.service.ts - Pattern for data aggregation (lines 267-350)
src/app/api/user/settings/route.ts - Pattern for authenticated API routes
Phase 2 (Operations):

src/app/error.tsx - Line 24 (Sentry TODO)
src/components/shared/error-boundary.tsx - Line 38 (Sentry TODO)
src/lib/services/notification.service.ts - Line 76 (add email sending)
src/app/api/admin/posts/[id]/route.ts - Line 47 (add cache invalidation)
Phase 3 (UX):

src/components/feed/post-card.tsx - Lines 148, 277, 408 (ARIA + alt text)
src/app/(main)/post/[id]/page.tsx - Lines 249, 275 (replace confirm)
src/app/(main)/feed/page.tsx - Lines 179, 184 (ARIA labels)
src/components/layout/notification-bell.tsx - Line 134 (ARIA label)
Key Patterns:

prisma/schema.prisma - User data model for GDPR export
src/lib/auth/index.ts - Authentication pattern (getAuthUser)
src/lib/csrf.ts - CSRF protection pattern (validateOrigin)
src/lib/redis/client.ts - Cache invalidation pattern (invalidateFeedCache)
Success Criteria
Phase 1 (GDPR) - Must Complete for MVP:

✅ Privacy policy, Terms, About pages accessible and comprehensive
✅ Users can export all their data as JSON
✅ Users can permanently delete their accounts
✅ Deletion flow uses custom modal (not native confirm)
✅ Deleted data anonymized per GDPR requirements
Phase 2 (Operations) - Must Complete for Production:

✅ Sentry captures all production errors
✅ Health endpoint responds < 100ms
✅ Admin actions invalidate feed cache
✅ Email notifications sent for comments (when preferences enabled)
Phase 3 (UX) - Critical for Trust:

✅ All icon buttons have aria-labels
✅ All confirm dialogs use custom modals
✅ Escape key closes all modals
✅ Images have descriptive alt text
Phase 4 (Testing) - Blocking for Release:

✅ No TypeScript errors
✅ Production build succeeds
✅ All GDPR flows tested end-to-end
✅ Accessibility validated with screen reader
Parallelization Opportunities
Phase 1: Tasks 1.1 and 1.2 can be done simultaneously (5 hours → 3 hours wall time)
Phase 2: All 4 tasks can be done simultaneously (10 hours → 4 hours wall time)
Phase 3: Tasks 3.1, 3.2, 3.3 can be done simultaneously (4 hours → 2 hours wall time)

Total Serial Time: 26-28 hours
Total Parallel Time: 14-16 hours (with 2-3 developers)

Environment Variables Needed

# Sentry (Phase 2.1)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=... # For source maps upload

# Resend (Phase 2.4)
RESEND_API_KEY=re_...

# App URL (for emails)
NEXT_PUBLIC_APP_URL=https://vecinu.ro
Notes
All implementations follow existing codebase patterns
Fire-and-forget promises properly handled with .catch()
All API routes include CSRF protection
Rate limiting applied to sensitive endpoints
Graceful degradation when optional services (Redis, Resend) unavailable
Romanian language throughout UI
Mobile-first responsive design