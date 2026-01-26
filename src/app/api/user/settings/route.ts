import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthenticationError, ValidationError } from '@/lib/errors';
import { getAuthUser } from '@/lib/auth';
import { validateOrigin } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize';
import { updateSettingsSchema } from '@/lib/validations/settings';

/**
 * GET /api/user/settings - Get current user settings
 */
export async function GET() {
  try {
    // Get authenticated user
    const authUser = await getAuthUser();

    // Fetch user with neighborhood
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        displayName: true,
        bio: true,
        email: true,
        notificationPreferences: true,
        language: true,
        neighborhood: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!user) {
      throw new AuthenticationError();
    }

    // Ensure notificationPreferences is properly formatted
    const notificationPreferences =
      typeof user.notificationPreferences === 'object' && user.notificationPreferences !== null
        ? user.notificationPreferences
        : {
            email_comments: true,
            email_alerts: true,
            email_digest: 'daily',
            push_enabled: true,
          };

    return successResponse({
      displayName: user.displayName,
      bio: user.bio,
      email: user.email,
      notificationPreferences,
      language: user.language,
      neighborhood: user.neighborhood,
    });
  } catch (error) {
    console.error('GET /api/user/settings error:', error);
    return handleApiError(error);
  }
}

/**
 * PATCH /api/user/settings - Update current user settings
 */
export async function PATCH(request: NextRequest) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new ValidationError('Cerere invalidă');
    }

    // Get authenticated user
    const authUser = await getAuthUser();

    // Parse and validate input
    const body = await request.json();
    const validatedData = updateSettingsSchema.parse(body);

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    // Sanitize text fields
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

    // Update notification preferences
    if (validatedData.notificationPreferences !== undefined) {
      updateData.notificationPreferences = validatedData.notificationPreferences;
    }

    // Update language
    if (validatedData.language !== undefined) {
      updateData.language = validatedData.language;
    }

    // Validate and update neighborhood if provided
    if (validatedData.neighborhoodId !== undefined) {
      const neighborhood = await prisma.neighborhood.findUnique({
        where: { id: validatedData.neighborhoodId },
      });

      if (!neighborhood) {
        throw new ValidationError('Cartierul selectat nu există');
      }

      if (neighborhood.status !== 'active') {
        throw new ValidationError('Cartierul selectat nu este disponibil');
      }

      updateData.neighborhoodId = validatedData.neighborhoodId;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: updateData,
      select: {
        displayName: true,
        bio: true,
        email: true,
        notificationPreferences: true,
        language: true,
        neighborhood: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return successResponse({
      displayName: updatedUser.displayName,
      bio: updatedUser.bio,
      email: updatedUser.email,
      notificationPreferences: updatedUser.notificationPreferences,
      language: updatedUser.language,
      neighborhood: updatedUser.neighborhood,
    });
  } catch (error) {
    console.error('PATCH /api/user/settings error:', error);
    return handleApiError(error);
  }
}