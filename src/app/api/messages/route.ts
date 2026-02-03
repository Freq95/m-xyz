import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError, RateLimitError, AuthorizationError } from '@/lib/errors';
import { validateOrigin } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize';
import { sendMessageSchema } from '@/lib/validations/message';
import { createNotification } from '@/lib/services/notification.service';
import { messageRateLimit } from '@/lib/rate-limit';

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

    // Check recipient exists and is not banned
    const recipient = await prisma.user.findUnique({
      where: { id: validatedData.recipientId },
      select: {
        id: true,
        isBanned: true,
        displayName: true,
        fullName: true,
        notificationPreferences: true,
      },
    });

    if (!recipient) {
      throw new NotFoundError('Utilizatorul');
    }

    if (recipient.isBanned) {
      throw new AuthorizationError('Utilizatorul nu poate primi mesaje');
    }

    // Sanitize message
    const sanitizedBody = sanitizeText(validatedData.body);
    if (sanitizedBody.length < 1) {
      throw new AuthorizationError('Mesajul este prea scurt');
    }

    // Get or create conversation (ensure userId1 < userId2 for uniqueness)
    const [userId1, userId2] = [user.id, validatedData.recipientId].sort();

    let conversation = await prisma.conversation.findUnique({
      where: {
        userId1_userId2: { userId1, userId2 },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { userId1, userId2 },
      });
    }

    // Get sender info for response
    const sender = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, displayName: true, fullName: true, avatarUrl: true },
    });

    if (!sender) {
      throw new NotFoundError('Utilizatorul');
    }

    // Create message and update conversation lastMessageAt
    const [message] = await prisma.$transaction([
      prisma.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          recipientId: validatedData.recipientId,
          body: sanitizedBody,
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    // Create notification (fire-and-forget, respect preferences)
    const prefs = recipient.notificationPreferences as { email_messages?: boolean } | null;
    if (!prefs || prefs.email_messages !== false) {
      const senderName = sender.displayName || sender.fullName;

      createNotification({
        userId: validatedData.recipientId,
        type: 'NEW_MESSAGE',
        title: `${senderName} ți-a trimis un mesaj`,
        body: sanitizedBody.substring(0, 100) + (sanitizedBody.length > 100 ? '...' : ''),
        data: { conversationId: conversation.id, senderId: user.id },
      }).catch((err) => console.error('Failed to create notification:', err));
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
