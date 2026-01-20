import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { registerSchema } from '@/lib/validations/auth';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { ConflictError, RateLimitError, InternalServerError, AuthorizationError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { authRateLimit, getClientIp } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection - validate request origin
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    // Validate APP_URL is configured (required for email verification)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl || !appUrl.startsWith('http')) {
      console.error('NEXT_PUBLIC_APP_URL is not configured properly');
      throw new InternalServerError('Configurație server incompletă');
    }

    // Apply rate limiting
    if (authRateLimit) {
      const ip = getClientIp(request);
      const { success } = await authRateLimit.limit(ip);
      if (!success) {
        throw new RateLimitError('Prea multe încercări. Încearcă din nou peste 15 minute.');
      }
    }

    const body = await request.json();

    // Validate input
    const { fullName, email, password } = registerSchema.parse(body);

    const normalizedEmail = email.toLowerCase();

    // Use transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Check if user already exists in our database
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new ConflictError('Această adresă de email este deja folosită');
      }

      // Create user in Supabase Auth (this will send verification email automatically)
      const supabase = await createClient();
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${appUrl}/auth/callback`,
        },
      });

      if (signUpError) {
        throw new ConflictError(
          signUpError.message.includes('already registered')
            ? 'Această adresă de email este deja folosită'
            : 'Eroare la crearea contului. Încearcă din nou.'
        );
      }

      if (!authData.user) {
        throw new ConflictError('Eroare la crearea contului. Încearcă din nou.');
      }

      // Create user in our database, linked to Supabase Auth user
      const user = await tx.user.create({
        data: {
          id: authData.user.id, // Use Supabase Auth user ID
          email: normalizedEmail,
          fullName,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          createdAt: true,
        },
      });

      return user;
    });

    return successResponse({
      user: result,
      message: 'Cont creat cu succes. Verifică-ți emailul pentru activare.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
