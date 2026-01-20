import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { RateLimitError, AuthorizationError, NotFoundError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { authRateLimit, getClientIp } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/csrf';

const resendSchema = z.object({
  email: z.string().email('Adresa de email nu este validă'),
});

export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    // Validate APP_URL is configured
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl || !appUrl.startsWith('http')) {
      console.error('NEXT_PUBLIC_APP_URL is not configured properly');
      throw new AuthorizationError('Configurație server incompletă');
    }

    // Rate limiting - stricter for resend (3 per 15 minutes)
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(`resend:${ip}`);
      if (!success) {
        throw new RateLimitError('Prea multe încercări. Așteaptă câteva minute.');
      }
    }

    const body = await request.json();
    const { email } = resendSchema.parse(body);
    const normalizedEmail = email.toLowerCase();

    // Use Supabase to resend verification email
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback`,
      },
    });

    if (error) {
      console.error('Resend verification error:', error.message);
      // Don't reveal if email exists or not for security
      // Just return success either way
    }

    // Always return success to prevent email enumeration attacks
    return successResponse({
      message: 'Dacă adresa există în sistem, vei primi un email de verificare.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
