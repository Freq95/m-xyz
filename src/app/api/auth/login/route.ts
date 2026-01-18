import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma/client';
import { loginSchema } from '@/lib/validations/auth';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthenticationError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const { email, password } = loginSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        isBanned: true,
        bannedReason: true,
        emailVerifiedAt: true,
        neighborhoodId: true,
        role: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new AuthenticationError('Email sau parolă incorectă');
    }

    // Check if banned
    if (user.isBanned) {
      throw new AuthenticationError(
        user.bannedReason
          ? `Contul tău a fost suspendat: ${user.bannedReason}`
          : 'Contul tău a fost suspendat'
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Email sau parolă incorectă');
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    // Create Supabase session
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    // If Supabase auth fails (user might not exist there), we still allow login
    // since we have our own password validation
    if (signInError) {
      console.warn('Supabase auth warning:', signInError.message);
    }

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
