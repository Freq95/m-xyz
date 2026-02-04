import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { conversationQuerySchema } from '@/lib/validations/message';
import { readRateLimit } from '@/lib/rate-limit';
import { RateLimitError } from '@/lib/errors';
import { redis } from '@/lib/redis/client';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    // Rate limiting
    if (readRateLimit) {
      const { success } = await readRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Prea multe cereri. Încearcă din nou mai târziu.');
      }
    }

    const { searchParams } = new URL(request.url);
    const query = conversationQuerySchema.parse({
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || 20,
    });

    // Check cache first (30s TTL, only for first page)
    const shouldCache = !query.cursor && redis;
    const cacheKey = shouldCache ? `conversations:${user.id}` : null;

    if (cacheKey && redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        // Upstash Redis auto-deserializes JSON, so cached is already an object
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return successResponse(data.data, data.meta);
      }
    }

    // Build cursor pagination
    let cursorCondition = {};
    if (query.cursor) {
      const cursorConvo = await prisma.conversation.findUnique({
        where: { id: query.cursor },
        select: { lastMessageAt: true },
      });
      if (cursorConvo?.lastMessageAt) {
        cursorCondition = { lastMessageAt: { lt: cursorConvo.lastMessageAt } };
      }
    }

    // Fetch conversations where user is either userId1 or userId2
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { userId1: user.id, ...cursorCondition },
          { userId2: user.id, ...cursorCondition },
        ],
      },
      orderBy: { lastMessageAt: 'desc' },
      take: query.limit + 1,
      include: {
        user1: { select: { id: true, displayName: true, username: true, fullName: true, avatarUrl: true } },
        user2: { select: { id: true, displayName: true, username: true, fullName: true, avatarUrl: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Last message preview
          select: { body: true, createdAt: true, senderId: true },
        },
        _count: {
          select: {
            messages: {
              where: { recipientId: user.id, isRead: false },
            },
          },
        },
      },
    });

    // Check pagination
    const hasMore = conversations.length > query.limit;
    const conversationsToReturn = hasMore ? conversations.slice(0, -1) : conversations;
    const nextCursor = hasMore ? conversationsToReturn[conversationsToReturn.length - 1]?.id : undefined;

    // Format response
    const formatted = conversationsToReturn.map((convo: any) => {
      const otherUser = convo.userId1 === user.id ? convo.user2 : convo.user1;
      const lastMessage = convo.messages[0] || null;

      return {
        id: convo.id,
        otherUser: {
          id: otherUser.id,
          name: otherUser.displayName || otherUser.fullName,
          username: otherUser.username,
          avatarUrl: otherUser.avatarUrl,
        },
        lastMessage: lastMessage ? {
          body: lastMessage.body,
          createdAt: lastMessage.createdAt,
          isFromMe: lastMessage.senderId === user.id,
        } : null,
        unreadCount: convo._count.messages,
        lastMessageAt: convo.lastMessageAt,
      };
    });

    // Cache the result for 30 seconds (first page only)
    if (cacheKey && redis) {
      // Upstash Redis auto-serializes objects, no need for JSON.stringify
      await redis.set(cacheKey, {
        data: formatted,
        meta: { cursor: nextCursor, hasMore },
      }, { ex: 30 });
    }

    return successResponse(formatted, { cursor: nextCursor, hasMore });
  } catch (error) {
    return handleApiError(error);
  }
}
