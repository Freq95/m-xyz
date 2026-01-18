import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthenticationError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  try {
    // Get session from Supabase
    const supabase = await createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();

    if (!supabaseUser?.email) {
      throw new AuthenticationError();
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: supabaseUser.email },
      select: {
        id: true,
        email: true,
        fullName: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        role: true,
        emailVerifiedAt: true,
        neighborhoodId: true,
        neighborhood: {
          select: {
            id: true,
            name: true,
            city: true,
            slug: true,
          },
        },
        notificationPreferences: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AuthenticationError();
    }

    return successResponse({
      user: {
        ...user,
        emailVerified: !!user.emailVerifiedAt,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
