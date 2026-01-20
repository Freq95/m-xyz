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

  // In development, allow requests without origin (e.g., from API clients)
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // If no app URL configured, skip validation (but log warning)
  if (!appUrl) {
    console.warn('CSRF: NEXT_PUBLIC_APP_URL not configured');
    return true;
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

  // No origin or referer - could be a direct API call
  // In production, we should be strict
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
