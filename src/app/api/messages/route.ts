import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError, RateLimitError, AuthorizationError } from '@/lib/errors';
import { validateOrigin } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize';
import { sendMessageSchema } from '@/lib/validations/message';
import { messageRateLimit } from '@/lib/rate-limit';
import { redis } from '@/lib/redis/client';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    const user = await getAuthUser();

    // Rate limiting
    if (messageRateLimit) {
      const { success } = await messageRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Ai atins limita de mesaje. Încearcă din nou mai târziu.');
      }
    }

    // Validate input
    const body = await request.json();
    const validatedData = sendMessageSchema.parse(body);

    // Can't message yourself
    if (validatedData.recipientId === user.id) {
      throw new AuthorizationError('Nu te poți trimite mesaje singur');
    }

    // Sanitize message first (cheap operation)
    const sanitizedBody = sanitizeText(validatedData.body);
    if (sanitizedBody.length < 1) {
      throw new AuthorizationError('Mesajul este prea scurt');
    }

    // Fetch all needed data in parallel (recipient check, sender info)
    const [userId1, userId2] = [user.id, validatedData.recipientId].sort();

    const [recipient, sender] = await Promise.all([
      prisma.user.findUnique({
        where: { id: validatedData.recipientId },
        select: {
          id: true,
          isBanned: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, displayName: true, fullName: true, avatarUrl: true },
      }),
    ]);

    // Validate recipient
    if (!recipient) {
      throw new NotFoundError('Utilizatorul');
    }

    if (recipient.isBanned) {
      throw new AuthorizationError('Utilizatorul nu poate primi mesaje');
    }

    if (!sender) {
      throw new NotFoundError('Utilizatorul');
    }

    // Create message and conversation in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // Use upsert for atomic get-or-create (prevents race condition)
      const conversation = await tx.conversation.upsert({
        where: {
          userId1_userId2: { userId1, userId2 },
        },
        update: {
          lastMessageAt: new Date(),
        },
        create: {
          userId1,
          userId2,
          lastMessageAt: new Date(),
        },
      });

      // Create message
      const message = await tx.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          recipientId: validatedData.recipientId,
          body: sanitizedBody,
        },
      });

      return { message, conversation };
    });

    const { message, conversation } = result;

    // Invalidate conversation list cache for both users
    if (redis) {
      await Promise.all([
        redis.del(`conversations:${user.id}`),
        redis.del(`conversations:${validatedData.recipientId}`),
        redis.del(`unread:${validatedData.recipientId}`), // Invalidate recipient's unread count
      ]);
    }

    return successResponse({
      id: message.id,
      conversationId: conversation.id,
      body: message.body,
      createdAt: message.createdAt,
      sender: {
        id: sender.id,
        name: sender.displayName || sender.fullName,
        avatarUrl: sender.avatarUrl,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
