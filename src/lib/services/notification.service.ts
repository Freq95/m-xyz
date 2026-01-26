import prisma from '@/lib/prisma/client';
import type { NotificationType } from '@/lib/validations/notification';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * Create a notification for a user
 * @returns The created notification or null if user opted out
 */
export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, body, data } = params;

  // Don't create notification for the user's own actions (handled by caller)
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body: body || null,
      data: data || null,
    },
  });

  return notification;
}

/**
 * Create notification when someone comments on a post
 */
export async function notifyPostComment(params: {
  postId: string;
  postAuthorId: string;
  commenterId: string;
  commenterName: string;
  postTitle: string | null;
}) {
  const { postId, postAuthorId, commenterId, commenterName, postTitle } = params;

  // Don't notify if commenting on own post
  if (postAuthorId === commenterId) {
    return null;
  }

  const title = `${commenterName} a comentat la postarea ta`;
  const body = postTitle || undefined;

  return createNotification({
    userId: postAuthorId,
    type: 'NEW_COMMENT',
    title,
    body,
    data: {
      postId,
      commenterId,
    },
  });
}

/**
 * Create notification when someone replies to a comment
 */
export async function notifyCommentReply(params: {
  postId: string;
  commentAuthorId: string;
  replierId: string;
  replierName: string;
}) {
  const { postId, commentAuthorId, replierId, replierName } = params;

  // Don't notify if replying to own comment
  if (commentAuthorId === replierId) {
    return null;
  }

  const title = `${replierName} a răspuns la comentariul tău`;

  return createNotification({
    userId: commentAuthorId,
    type: 'COMMENT_REPLY',
    title,
    data: {
      postId,
      replierId,
    },
  });
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}
