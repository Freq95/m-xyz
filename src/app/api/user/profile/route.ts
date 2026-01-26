import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize';
import { z } from 'zod';

const updateProfileSchema = z.object({
  displayName: z.string().max(50, 'Numele nu poate depăși 50 de caractere').optional(),
  bio: z.string().max(500, 'Bio-ul nu poate depăși 500 de caractere').optional(),
});

/**
 * PATCH /api/user/profile - Update current user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    // Parse and validate input
    const body = await request.json();
    const validatedData = updateProfileSchema.parse(body);

    // Sanitize text content
    const updateData: Record<string, unknown> = {};

    if (validatedData.displayName !== undefined) {
      updateData.displayName = validatedData.displayName
        ? sanitizeText(validatedData.displayName)
        : null;
    }

    if (validatedData.bio !== undefined) {
      updateData.bio = validatedData.bio
        ? sanitizeText(validatedData.bio)
        : null;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
      },
    });

    return successResponse({
      id: updatedUser.id,
      name: updatedUser.displayName || updatedUser.fullName,
      displayName: updatedUser.displayName,
      avatarUrl: updatedUser.avatarUrl,
      bio: updatedUser.bio,
    });
  } catch (error) {
    console.error('PATCH /api/user/profile error:', error);
    return handleApiError(error);
  }
}
