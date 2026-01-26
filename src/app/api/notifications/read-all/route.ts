import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin } from '@/lib/csrf';

/**
 * POST /api/notifications/read-all - Mark all notifications as read
 */
export async function POST(request: NextRequest) {
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

    // Mark all unread notifications as read
    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return successResponse({
      success: true,
      count: result.count,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
