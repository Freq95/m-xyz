import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Routes that require authentication
const protectedRoutes = ['/feed', '/post', '/profile', '/settings', '/notifications', '/admin'];

// Allowed redirect paths (must be internal routes)
const allowedRedirectPaths = ['/feed', '/post', '/profile', '/settings', '/notifications', '/onboarding', '/admin'];

/**
 * Validates that a redirect path is safe (internal, relative path only)
 * Prevents open redirect vulnerabilities
 */
function isValidRedirectPath(path: string): boolean {
  // Must start with / (relative path)
  if (!path.startsWith('/')) {
    return false;
  }

  // Must not contain protocol or domain indicators
  if (path.includes('://') || path.startsWith('//')) {
    return false;
  }

  // Must be one of the allowed paths or start with one
  return allowedRedirectPaths.some((allowed) => path === allowed || path.startsWith(allowed + '/'));
}

// Routes that should redirect to feed if already authenticated
const authRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Check if Supabase is configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Supabase not configured, skipping auth middleware');
    return response;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options });
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            });
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Get user session
    const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Check if accessing protected route
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));
  const isOnboardingRoute = pathname.startsWith('/onboarding');

  // Handle authenticated users
  if (user) {
    // Check user's neighborhood from metadata
    const hasNeighborhood = !!user.user_metadata?.neighborhoodId;

    // Redirect to onboarding if trying to access protected routes without neighborhood
    if (isProtectedRoute && !hasNeighborhood) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }

    // Redirect to feed if on onboarding but already has neighborhood
    if (isOnboardingRoute && hasNeighborhood) {
      const url = request.nextUrl.clone();
      url.pathname = '/feed';
      return NextResponse.redirect(url);
    }

    // Redirect authenticated users from auth routes based on neighborhood status
    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = hasNeighborhood ? '/feed' : '/onboarding';
      return NextResponse.redirect(url);
    }
  }

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Only set redirect if it's a valid internal path (prevents open redirect)
    if (isValidRedirectPath(pathname)) {
      url.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(url);
  }

  // Redirect unauthenticated users from onboarding
  if (isOnboardingRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

    return response;
  } catch (error) {
    console.error('Middleware error:', error);

    const { pathname } = request.nextUrl;
    const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
    const isOnboardingRoute = pathname.startsWith('/onboarding');

    // On error, deny access to protected routes (security first)
    if (isProtectedRoute || isOnboardingRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'session_error');
      return NextResponse.redirect(url);
    }

    // Allow public routes to proceed
    return response;
  }
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
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
