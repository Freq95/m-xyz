import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Routes that require authentication
const protectedRoutes = ['/feed', '/post', '/profile', '/settings', '/notifications'];

// Routes that should redirect to feed if already authenticated
const authRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  // Update Supabase session
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  // Check if accessing protected route
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Get session from cookie (simplified check)
  const hasSession = request.cookies.has('sb-access-token') ||
    request.cookies.getAll().some(c => c.name.includes('auth-token'));

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users from auth routes
  if (isAuthRoute && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/feed';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
