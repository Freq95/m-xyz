# Authentication Testing Guide

## Overview

This guide walks through testing the newly implemented Supabase Auth authentication system end-to-end.

## Prerequisites

Before testing, ensure:

1. **Supabase Project Configured**
   - Email confirmation is enabled in Supabase Dashboard > Authentication > Email Templates
   - Confirm email template is set up
   - SMTP settings configured (or using Supabase's default email service)

2. **Environment Variables Set**
   - Copy `.env.example` to `.env.local`
   - Fill in all Supabase credentials:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `DATABASE_URL` (using Session Pooler format)

3. **Optional: Rate Limiting**
   - Set up Upstash Redis account (free tier)
   - Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   - Rate limiting will be disabled if these aren't set (works for testing)

4. **Database Schema Applied**
   ```bash
   npm run db:push
   ```

5. **Development Server Running**
   ```bash
   npm run dev
   ```

---

## Test Flow: Complete Authentication Cycle

### 1. Test User Registration

**Steps:**
1. Navigate to `http://localhost:3000/register`
2. Fill in the registration form:
   - Full Name: "Test User"
   - Email: Use a real email you can access
   - Password: "TestPassword123!"
3. Click "Înregistrează-te" (Register)

**Expected Results:**
- ✅ Success message: "Cont creat cu succes. Verifică-ți emailul pentru activare."
- ✅ User created in Supabase Auth (check Dashboard > Authentication > Users)
- ✅ User created in Prisma database (check with `npm run db:studio`)
- ✅ Verification email sent to your inbox
- ✅ User IDs match in both Supabase Auth and Prisma database

**Common Issues:**
- "Această adresă de email este deja folosită" → Email already registered, use different email
- No verification email → Check Supabase email settings, check spam folder
- Database error → Verify DATABASE_URL is correct Session Pooler format

---

### 2. Test Email Verification

**Steps:**
1. Check your email inbox for verification email
2. Click the verification link in the email
3. Should redirect to the callback endpoint

**Expected Results:**
- ✅ Redirect to `/feed` (or login page if session expired)
- ✅ `emailVerifiedAt` timestamp updated in database
- ✅ User can now log in

**Common Issues:**
- Link expired → Supabase verification links expire after 24 hours by default
- Redirect fails → Check `NEXT_PUBLIC_APP_URL` is set correctly
- Database not updated → Check callback route at `src/app/auth/callback/route.ts`

---

### 3. Test User Login (Verified Email)

**Steps:**
1. Navigate to `http://localhost:3000/login`
2. Enter your email and password
3. Click "Autentifică-te" (Login)

**Expected Results:**
- ✅ Success response with user data
- ✅ Session cookies set (check browser DevTools > Application > Cookies)
- ✅ Redirect to `/feed` page
- ✅ `lastActiveAt` timestamp updated in database
- ✅ User can access protected routes

**Common Issues:**
- "Email sau parolă incorectă" → Check password, check user exists in Supabase Auth
- No redirect → Check middleware configuration
- Session not created → Check Supabase client setup

---

### 4. Test Protected Route Access

**Steps:**
1. After logging in, navigate to `http://localhost:3000/feed`
2. Open browser DevTools > Network tab
3. Refresh the page

**Expected Results:**
- ✅ Page loads successfully (no redirect to login)
- ✅ Middleware allows access
- ✅ User session is valid

**Test Unauthenticated Access:**
1. Open incognito window
2. Navigate to `http://localhost:3000/feed`

**Expected Results:**
- ✅ Redirected to `/login?redirect=/feed`
- ✅ Cannot access protected route without authentication

---

### 5. Test Logout

**Steps:**
1. While logged in, call the logout API:
   ```bash
   curl -X POST http://localhost:3000/api/auth/logout \
     -H "Content-Type: application/json" \
     --cookie "your-session-cookie"
   ```
   Or create a logout button in the UI

**Expected Results:**
- ✅ Success message: "Ai fost deconectat cu succes"
- ✅ Session cookies cleared
- ✅ Redirect to login when accessing protected routes
- ✅ Cannot access `/feed` anymore

---

### 6. Test Rate Limiting (If Configured)

**Only if Upstash Redis is configured**

**Steps:**
1. Try to register/login 6 times within 15 minutes from the same IP
2. Observe the 6th request

**Expected Results:**
- ✅ First 5 requests succeed
- ✅ 6th request fails with 429 status code
- ✅ Error message: "Prea multe încercări. Încearcă din nou peste 15 minute."
- ✅ After 15 minutes, rate limit resets

**Test Without Redis:**
- If Upstash is not configured, rate limiting is gracefully disabled
- All requests succeed (no rate limiting applied)

---

### 7. Test Banned User

**Steps:**
1. In `npm run db:studio`, find your test user
2. Set `isBanned = true` and `bannedReason = "Test ban"`
3. Try to log in with that user

**Expected Results:**
- ✅ Login fails with error: "Contul tău a fost suspendat: Test ban"
- ✅ No session created
- ✅ User cannot access the app

---

### 8. Test Duplicate Registration

**Steps:**
1. Try to register again with the same email

**Expected Results:**
- ✅ Error: "Această adresă de email este deja folosită"
- ✅ No duplicate user created
- ✅ Supabase Auth also rejects duplicate

---

## Manual Testing Checklist

Use this checklist to verify all functionality:

### Registration Flow
- [ ] User can access registration page
- [ ] Form validation works (required fields, email format, password strength)
- [ ] Valid registration creates user in both Supabase Auth and database
- [ ] User IDs match between Supabase Auth and Prisma
- [ ] Verification email is sent
- [ ] Duplicate email is rejected
- [ ] Rate limiting works (if configured)

### Email Verification Flow
- [ ] Verification email arrives (check spam folder)
- [ ] Verification link redirects correctly
- [ ] emailVerifiedAt timestamp is set in database
- [ ] Expired links are handled gracefully

### Login Flow
- [ ] User can access login page
- [ ] Valid credentials log user in
- [ ] Invalid credentials are rejected
- [ ] Banned users cannot log in
- [ ] Session cookies are set correctly
- [ ] lastActiveAt is updated
- [ ] Rate limiting works (if configured)

### Session Management
- [ ] Logged-in users can access protected routes
- [ ] Unauthenticated users are redirected to login
- [ ] Session persists across page reloads
- [ ] Middleware correctly checks session

### Logout Flow
- [ ] Logout clears session cookies
- [ ] After logout, protected routes redirect to login
- [ ] Logout works from all pages

### Edge Cases
- [ ] Network errors are handled gracefully
- [ ] Database connection errors show proper message
- [ ] Malformed requests are rejected
- [ ] CORS is configured correctly (if needed)

---

## Debugging Tips

### Check Supabase Auth Users
```
Supabase Dashboard > Authentication > Users
```
- Verify user exists
- Check email confirmation status
- Check last sign-in time

### Check Database
```bash
npm run db:studio
```
- Open Prisma Studio
- Navigate to User table
- Verify user record exists
- Check emailVerifiedAt, lastActiveAt timestamps

### Check Session Cookies
```
Browser DevTools > Application > Cookies
```
Look for cookies starting with `sb-` (Supabase session cookies)

### Check Network Requests
```
Browser DevTools > Network tab
```
- Monitor API calls to `/api/auth/*`
- Check request/response payloads
- Look for error status codes

### Check Logs
```bash
# Terminal where dev server is running
npm run dev
```
- Look for console.log outputs
- Check for error stack traces
- Monitor Supabase client errors

### Test API Endpoints Directly

**Register:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

**Logout:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  --cookie "sb-access-token=YOUR_TOKEN"
```

---

## Known Limitations

1. **Email Verification Required**
   - Users cannot log in without verifying email
   - Consider adding "resend verification email" feature

2. **Password Reset Not Implemented**
   - Will be added in future iteration
   - Supabase Auth supports this natively

3. **Rate Limiting Optional**
   - Works without Upstash, but recommended for production
   - Free tier: 10,000 commands/day

4. **No Remember Me**
   - Supabase session expires based on JWT expiry
   - Default: 1 hour, refresh token: 30 days

---

## Next Steps After Testing

Once all tests pass:

1. **Deploy to Vercel**
   - Set environment variables in Vercel dashboard
   - Test in production environment

2. **Configure Supabase Email Templates**
   - Customize email verification template
   - Add branding and styling

3. **Set Up Error Monitoring**
   - Install Sentry
   - Monitor auth errors in production

4. **Add Password Reset Flow**
   - Implement forgot password
   - Use Supabase's password reset

5. **Implement Social Auth (Optional)**
   - Google OAuth
   - Facebook Login
   - Supabase Auth supports these natively

---

## Security Checklist

Before going to production:

- [ ] All environment variables secured (never commit .env.local)
- [ ] Rate limiting enabled with Upstash Redis
- [ ] HTTPS enforced (Vercel does this automatically)
- [ ] Session cookies are httpOnly and secure
- [ ] Email verification required for login
- [ ] Strong password requirements enforced
- [ ] Banned users cannot access the app
- [ ] Error messages don't leak sensitive information

---

**Last Updated:** 2026-01-18
**Auth System:** Supabase Auth Only
**Status:** Ready for Testing
