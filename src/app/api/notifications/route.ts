import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { notificationQuerySchema } from '@/lib/validations/notification';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthenticationError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { getUnreadCount } from '@/lib/services/notification.service';

/**
 * GET /api/notifications - Get notifications for current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const query = notificationQuerySchema.parse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || 20,
      unreadOnly: searchParams.get('unreadOnly') === 'true',
    });

    // Build cursor condition for pagination
    let cursorCondition = {};
    if (query.cursor) {
      const cursorNotification = await prisma.notification.findUnique({
        where: { id: query.cursor },
        select: { createdAt: true },
      });
      if (cursorNotification?.createdAt) {
        cursorCondition = { createdAt: { lt: cursorNotification.createdAt } };
      }
    }

    // Fetch notifications
    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(query.unreadOnly && { isRead: false }),
        ...cursorCondition,
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
    });

    // Check if there are more notifications
    const hasMore = notifications.length > query.limit;
    const notificationsToReturn = hasMore ? notifications.slice(0, -1) : notifications;
    const nextCursor = hasMore ? notificationsToReturn[notificationsToReturn.length - 1]?.id : undefined;

    // Get unread count
    const unreadCount = await getUnreadCount(user.id);

    return successResponse(
      notificationsToReturn.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        isRead: notification.isRead,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      })),
      { cursor: nextCursor, hasMore, unreadCount }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
