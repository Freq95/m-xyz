import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    // Count unread messages for this user
    const unreadCount = await prisma.directMessage.count({
      where: {
        recipientId: user.id,
        isRead: false,
      },
    });

    return successResponse({ unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}
