import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma/client';
import { selectNeighborhoodSchema } from '@/lib/validations/user';
import { handleApiError } from '@/lib/errors/handler';
import { AuthenticationError, AuthorizationError, NotFoundError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin } from '@/lib/csrf';

/**
 * POST /api/user/select-neighborhood
 * Updates user's neighborhood selection
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF protection - validate request origin
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    // Check authentication
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      throw new AuthenticationError('Trebuie să fii autentificat');
    }

    // Parse and validate request body
    const body = await request.json();
    const { neighborhoodId } = selectNeighborhoodSchema.parse(body);

    // Check if neighborhood exists and is active
    const neighborhood = await prisma.neighborhood.findUnique({
      where: { id: neighborhoodId },
    });

    if (!neighborhood || !neighborhood.isActive) {
      throw new NotFoundError('Cartierul selectat nu este disponibil');
    }

    // Get user's current neighborhood to decrement its count if switching
    const currentUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { neighborhoodId: true },
    });

    const oldNeighborhoodId = currentUser?.neighborhoodId;
    const isSwitching = oldNeighborhoodId && oldNeighborhoodId !== neighborhoodId;

    // Update user and adjust neighborhood member counts in a transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update user's neighborhood
      const user = await tx.user.update({
        where: { id: authUser.id },
        data: { neighborhoodId },
        select: {
          id: true,
          email: true,
          fullName: true,
          neighborhoodId: true,
          neighborhood: {
            select: {
              id: true,
              name: true,
              city: true,
              slug: true,
            },
          },
        },
      });

      // Decrement old neighborhood count if switching
      if (isSwitching) {
        await tx.neighborhood.update({
          where: { id: oldNeighborhoodId },
          data: {
            memberCount: {
              decrement: 1,
            },
          },
        });
      }

      // Only increment new neighborhood if not already a member
      if (!oldNeighborhoodId || isSwitching) {
        await tx.neighborhood.update({
          where: { id: neighborhoodId },
          data: {
            memberCount: {
              increment: 1,
            },
          },
        });
      }

      return user;
    });

    // Update Supabase user metadata for middleware access
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        neighborhoodId,
      },
    });

    if (updateError) {
      console.error('Failed to update user metadata:', updateError);
      // Don't throw error - the database update succeeded, this is just for caching
    }

    // Set a cookie to signal onboarding completion (fixes middleware race condition)
    // This provides immediate feedback to middleware before JWT metadata is refreshed
    const response = NextResponse.json({
      success: true,
      data: {
        user: updatedUser,
        message: 'Cartier selectat cu succes',
      },
    });

    response.cookies.set('has_neighborhood', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
