import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { loginSchema } from '@/lib/validations/auth';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthenticationError, AuthorizationError, RateLimitError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { authRateLimit, getClientIp } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection - validate request origin
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    // Apply rate limiting
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);
      if (!success) {
        throw new RateLimitError('Prea multe încercări de autentificare. Încearcă din nou peste 15 minute.');
      }
    }

    const body = await request.json();

    // Validate input
    const { email, password } = loginSchema.parse(body);

    const normalizedEmail = email.toLowerCase();

    // Authenticate with Supabase Auth first (prevents user enumeration)
    const supabase = await createClient();
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    // Return generic error for failed authentication (prevents user enumeration)
    if (signInError || !authData.user) {
      throw new AuthenticationError('Email sau parolă incorectă');
    }

    // Find user in our database (only after successful Supabase auth)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        fullName: true,
        isBanned: true,
        bannedReason: true,
        emailVerifiedAt: true,
        neighborhoodId: true,
        role: true,
      },
    });

    if (!user) {
      // User exists in Supabase but not in our DB (should not happen)
      throw new AuthenticationError('Email sau parolă incorectă');
    }

    // Check if banned (separate error after auth succeeds, prevents timing attacks)
    if (user.isBanned) {
      // Log the ban check server-side only
      console.warn(`Banned user login attempt: ${user.email}`);
      throw new AuthenticationError(
        user.bannedReason
          ? `Contul tău a fost suspendat: ${user.bannedReason}`
          : 'Contul tău a fost suspendat'
      );
    }

    // Update last active timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    // Return user data (without sensitive fields)
    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        emailVerified: !!user.emailVerifiedAt,
        hasNeighborhood: !!user.neighborhoodId,
        role: user.role,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
