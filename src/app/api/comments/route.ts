import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { createCommentSchema, commentQuerySchema } from '@/lib/validations/comment';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import {
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  NotFoundError,
} from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { commentRateLimit } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize';
import { notifyPostComment, notifyCommentReply } from '@/lib/services/notification.service';

/**
 * GET /api/comments - Get comments for a post
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const query = commentQuerySchema.parse({
      postId: searchParams.get('postId'),
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || 20,
    });

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: query.postId },
      select: { id: true, status: true },
    });

    if (!post || post.status === 'deleted') {
      throw new NotFoundError('Postarea');
    }

    // Build cursor condition for pagination
    let cursorCondition = {};
    if (query.cursor) {
      const cursorComment = await prisma.comment.findUnique({
        where: { id: query.cursor },
        select: { createdAt: true }
      });
      if (cursorComment?.createdAt) {
        cursorCondition = { createdAt: { gt: cursorComment.createdAt } };
      }
    }

    // Fetch top-level comments (no parentId)
    const comments = await prisma.comment.findMany({
      where: {
        postId: query.postId,
        parentId: null,
        status: 'active',
        ...cursorCondition,
      },
      orderBy: { createdAt: 'asc' },
      take: query.limit + 1,
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        replies: {
          where: { status: 'active' },
          orderBy: { createdAt: 'asc' },
          take: 3, // Show first 3 replies
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
        },
        _count: {
          select: { replies: true },
        },
      },
    });

    // Check if there are more comments
    const hasMore = comments.length > query.limit;
    const commentsToReturn = hasMore ? comments.slice(0, -1) : comments;
    const nextCursor = hasMore ? commentsToReturn[commentsToReturn.length - 1]?.id : undefined;

    return successResponse(
      commentsToReturn.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        author: {
          id: comment.author.id,
          name: comment.author.displayName || comment.author.fullName,
          avatarUrl: comment.author.avatarUrl,
        },
        replyCount: comment._count.replies,
        replies: comment.replies.map((reply) => ({
          id: reply.id,
          body: reply.body,
          createdAt: reply.createdAt,
          author: {
            id: reply.author.id,
            name: reply.author.displayName || reply.author.fullName,
            avatarUrl: reply.author.avatarUrl,
          },
        })),
      })),
      { cursor: nextCursor, hasMore }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/comments - Create a new comment
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    // Check rate limit
    if (commentRateLimit) {
      const { success } = await commentRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Ai atins limita de comentarii. Încearcă din nou mai târziu.');
      }
    }

    // Get user from database to check ban status
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        isBanned: true,
        fullName: true,
        displayName: true,
        avatarUrl: true,
      },
    });

    if (!dbUser) {
      throw new AuthenticationError('Contul nu a fost găsit');
    }

    if (dbUser.isBanned) {
      throw new AuthorizationError('Contul tău a fost suspendat');
    }

    // Parse and validate input
    const body = await request.json();
    const validatedData = createCommentSchema.parse(body);

    // Check if post exists and is active
    const post = await prisma.post.findUnique({
      where: { id: validatedData.postId },
      select: { id: true, status: true, authorId: true, title: true },
    });

    if (!post || post.status === 'deleted') {
      throw new NotFoundError('Postarea');
    }

    // If replying, check if parent comment exists
    let parentCommentAuthorId: string | null = null;
    if (validatedData.parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: validatedData.parentId },
        select: { id: true, postId: true, status: true, authorId: true },
      });

      if (!parentComment || parentComment.status !== 'active') {
        throw new NotFoundError('Comentariul');
      }

      // Ensure parent comment belongs to same post
      if (parentComment.postId !== validatedData.postId) {
        throw new AuthorizationError('Comentariul părinte nu aparține acestei postări');
      }

      parentCommentAuthorId = parentComment.authorId;
    }

    // Sanitize content
    const sanitizedBody = sanitizeText(validatedData.body);

    if (sanitizedBody.length < 1) {
      throw new AuthorizationError('Comentariul este prea scurt după curățare');
    }

    // Create comment and update post comment count in transaction
    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: {
          postId: validatedData.postId,
          authorId: dbUser.id,
          parentId: validatedData.parentId || null,
          body: sanitizedBody,
        },
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
      }),
      prisma.post.update({
        where: { id: validatedData.postId },
        data: { commentCount: { increment: 1 } },
      }),
    ]);

    // Create notifications (fire and forget, don't block response)
    const commenterName = dbUser.displayName || dbUser.fullName;

    if (validatedData.parentId && parentCommentAuthorId) {
      // Notify parent comment author of reply
      notifyCommentReply({
        postId: validatedData.postId,
        commentAuthorId: parentCommentAuthorId,
        replierId: dbUser.id,
        replierName: commenterName,
      }).catch((err) => console.error('Failed to create reply notification:', err));
    } else {
      // Notify post author of new comment
      notifyPostComment({
        postId: validatedData.postId,
        postAuthorId: post.authorId,
        commenterId: dbUser.id,
        commenterName: commenterName,
        postTitle: post.title,
      }).catch((err) => console.error('Failed to create comment notification:', err));
    }

    return successResponse({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      parentId: comment.parentId,
      author: {
        id: comment.author.id,
        name: comment.author.displayName || comment.author.fullName,
        avatarUrl: comment.author.avatarUrl,
      },
    });
  } catch (error) {
    console.error('POST /api/comments error:', error);
    return handleApiError(error);
  }
}
