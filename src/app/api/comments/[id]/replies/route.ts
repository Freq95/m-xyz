import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError } from '@/lib/errors';

/**
 * GET /api/comments/[id]/replies - Get all replies for a comment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;

    // Check if comment exists and is active
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, status: true },
    });

    if (!comment || comment.status !== 'active') {
      throw new NotFoundError('Comentariul');
    }

    // Fetch all replies for this comment
    const replies = await prisma.comment.findMany({
      where: {
        parentId: commentId,
        status: 'active',
      },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return successResponse(
      replies.map((reply) => ({
        id: reply.id,
        body: reply.body,
        createdAt: reply.createdAt,
        author: {
          id: reply.author.id,
          name: reply.author.displayName || reply.author.fullName,
          avatarUrl: reply.author.avatarUrl,
        },
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
