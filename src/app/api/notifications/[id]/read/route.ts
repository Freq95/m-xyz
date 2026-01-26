import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthenticationError, AuthorizationError, NotFoundError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin } from '@/lib/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/notifications/[id]/read - Mark a notification as read
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    const { id } = await context.params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    // Find the notification
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true, isRead: true },
    });

    if (!notification) {
      throw new NotFoundError('Notificarea');
    }

    // Check ownership
    if (notification.userId !== user.id) {
      throw new AuthorizationError('Nu poți modifica această notificare');
    }

    // Mark as read if not already
    if (!notification.isRead) {
      await prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
