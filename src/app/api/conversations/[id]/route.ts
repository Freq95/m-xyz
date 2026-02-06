import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError, AuthorizationError, RateLimitError } from '@/lib/errors';
import { messageQuerySchema } from '@/lib/validations/message';
import { readRateLimit } from '@/lib/rate-limit';
import { redis } from '@/lib/redis/client';
import { isUserBlocked } from '@/lib/services/block.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser();

    // Rate limiting
    if (readRateLimit) {
      const { success } = await readRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Prea multe cereri. Încearcă din nou mai târziu.');
      }
    }

    const conversationId = params.id;
    const { searchParams } = new URL(request.url);

    // Validate query parameters with Zod schema
    const query = messageQuerySchema.parse({
      conversationId,
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || 30,
    });

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

    // Check if either user has blocked the other
    const otherUserId = conversation.userId1 === user.id ? conversation.userId2 : conversation.userId1;
    const blocked = await isUserBlocked(user.id, otherUserId);

    if (blocked) {
      throw new NotFoundError('Conversația');
    }

    // Build cursor pagination (DESC order - newest first)
    let cursorCondition = {};
    if (query.cursor) {
      const cursorMsg = await prisma.directMessage.findUnique({
        where: { id: query.cursor },
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
      take: query.limit + 1,
      include: {
        sender: {
          select: { id: true, displayName: true, username: true, fullName: true, avatarUrl: true },
        },
      },
    });

    // Check pagination
    const hasMore = messages.length > query.limit;
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
        username: msg.sender.username,
        avatarUrl: msg.sender.avatarUrl,
      },
    }));

    // Mark messages as read with retry logic (non-blocking)
    const markAsRead = async (retries = 3) => {
      try {
        await prisma.directMessage.updateMany({
          where: {
            conversationId,
            recipientId: user.id,
            isRead: false,
          },
          data: {
            isRead: true,
            readAt: new Date(),
          },
        });

        // Invalidate unread count cache on success
        if (redis) {
          await redis.del(`unread:${user.id}`);
        }
      } catch (err: any) {
        if (retries > 0) {
          // Exponential backoff: 100ms, 200ms, 400ms
          const delay = 100 * Math.pow(2, 3 - retries);
          setTimeout(() => markAsRead(retries - 1), delay);
        } else {
          console.error('Failed to mark messages as read after 3 retries:', err);
        }
      }
    };

    markAsRead();

    return successResponse(formatted, { cursor: nextCursor, hasMore });
  } catch (error) {
    return handleApiError(error);
  }
}
