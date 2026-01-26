import { NextRequest } from 'next/server';

/**
 * Validates that the request originates from our own domain.
 * This provides basic CSRF protection for API routes.
 *
 * Note: Next.js Server Actions have built-in CSRF protection,
 * but API Routes need manual validation.
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // In development, be more lenient with localhost variants
  if (process.env.NODE_ENV === 'development') {
    // Allow localhost variants (localhost, 127.0.0.1, etc.)
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
          return true;
        }
      } catch {
        // Invalid origin URL, continue with other checks
      }
    }

    // Allow requests without origin (same-origin or API tools)
    if (!origin && !referer) {
      return true;
    }

    // Check referer for localhost
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.hostname === 'localhost' || refererUrl.hostname === '127.0.0.1') {
          return true;
        }
      } catch {
        // Invalid referer URL
      }
    }
  }

  // If no app URL configured, skip validation (but log warning)
  if (!appUrl) {
    console.warn('CSRF: NEXT_PUBLIC_APP_URL not configured');
    return process.env.NODE_ENV === 'development';
  }

  const allowedOrigin = new URL(appUrl).origin;

  // Check origin header first (preferred)
  if (origin) {
    return origin === allowedOrigin;
  }

  // Fall back to referer header
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return refererOrigin === allowedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Error to throw when CSRF validation fails
 */
export class CSRFError extends Error {
  public statusCode = 403;
  public code = 'CSRF_ERROR';

  constructor() {
    super('Cerere invalidă');
    this.name = 'CSRFError';
  }
}
