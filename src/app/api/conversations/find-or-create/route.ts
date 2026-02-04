import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError } from '@/lib/errors';
import { z } from 'zod';

const querySchema = z.object({
  userId: z.string().uuid('ID utilizator invalid'),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    const { searchParams } = new URL(request.url);

    const validated = querySchema.parse({
      userId: searchParams.get('userId'),
    });

    // Can't create conversation with yourself
    if (validated.userId === user.id) {
      throw new NotFoundError('Conversația');
    }

    // Check if other user exists
    const otherUser = await prisma.user.findUnique({
      where: { id: validated.userId },
      select: { id: true, isBanned: true },
    });

    if (!otherUser || otherUser.isBanned) {
      throw new NotFoundError('Utilizatorul');
    }

    // Get or create conversation
    const [userId1, userId2] = [user.id, validated.userId].sort();

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

    return successResponse({ conversationId: conversation.id });
  } catch (error) {
    return handleApiError(error);
  }
}
