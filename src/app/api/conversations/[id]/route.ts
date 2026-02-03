import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError, AuthorizationError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();
    const conversationId = params.id;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') || undefined;
    const limit = parseInt(searchParams.get('limit') || '30');

    // Check conversation exists and user is participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId1: true, userId2: true },
    });

    if (!conversation) {
      throw new NotFoundError('Conversația');
    }

    if (conversation.userId1 !== user.id && conversation.userId2 !== user.id) {
      throw new AuthorizationError('Nu ai acces la această conversație');
    }

    // Build cursor pagination (DESC order - newest first)
    let cursorCondition = {};
    if (cursor) {
      const cursorMsg = await prisma.directMessage.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });
      if (cursorMsg?.createdAt) {
        cursorCondition = { createdAt: { lt: cursorMsg.createdAt } };
      }
    }

    // Fetch messages
    const messages = await prisma.directMessage.findMany({
      where: {
        conversationId,
        ...cursorCondition,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        sender: {
          select: { id: true, displayName: true, fullName: true, avatarUrl: true },
        },
      },
    });

    // Check pagination
    const hasMore = messages.length > limit;
    const messagesToReturn = hasMore ? messages.slice(0, -1) : messages;
    const nextCursor = hasMore ? messagesToReturn[messagesToReturn.length - 1]?.id : undefined;

    // Format response
    const formatted = messagesToReturn.map((msg: any) => ({
      id: msg.id,
      body: msg.body,
      createdAt: msg.createdAt,
      isFromMe: msg.senderId === user.id,
      isRead: msg.isRead,
      sender: {
        id: msg.sender.id,
        name: msg.sender.displayName || msg.sender.fullName,
        avatarUrl: msg.sender.avatarUrl,
      },
    }));

    // Mark messages as read (fire-and-forget)
    prisma.directMessage.updateMany({
      where: {
        conversationId,
        recipientId: user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    }).catch((err: any) => console.error('Failed to mark messages as read:', err));

    return successResponse(formatted, { cursor: nextCursor, hasMore });
  } catch (error) {
    return handleApiError(error);
  }
}
