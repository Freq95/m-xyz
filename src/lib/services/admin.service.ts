import prisma from '@/lib/prisma/client';

export type AdminAction =
  | 'hide_post'
  | 'unhide_post'
  | 'hide_comment'
  | 'unhide_comment'
  | 'ban_user'
  | 'unban_user'
  | 'dismiss_report'
  | 'resolve_report';

export type TargetType = 'post' | 'comment' | 'user' | 'report';

interface AuditLogParams {
  adminId: string;
  action: AdminAction;
  targetType: TargetType;
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create an audit log entry for admin actions
 */
export async function createAuditLog(params: AuditLogParams) {
  return prisma.auditLog.create({
    data: {
      adminId: params.adminId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      metadata: params.metadata,
    },
  });
}

/**
 * Hide a post (set status to 'hidden')
 */
export async function hidePost(adminId: string, postId: string, reason?: string) {
  const post = await prisma.post.update({
    where: { id: postId },
    data: { status: 'hidden' },
  });

  await createAuditLog({
    adminId,
    action: 'hide_post',
    targetType: 'post',
    targetId: postId,
    reason,
  });

  return post;
}

/**
 * Unhide a post (set status back to 'active')
 */
export async function unhidePost(adminId: string, postId: string) {
  const post = await prisma.post.update({
    where: { id: postId },
    data: { status: 'active' },
  });

  await createAuditLog({
    adminId,
    action: 'unhide_post',
    targetType: 'post',
    targetId: postId,
  });

  return post;
}

/**
 * Hide a comment (set status to 'hidden')
 */
export async function hideComment(adminId: string, commentId: string, reason?: string) {
  const comment = await prisma.comment.update({
    where: { id: commentId },
    data: { status: 'hidden' },
  });

  await createAuditLog({
    adminId,
    action: 'hide_comment',
    targetType: 'comment',
    targetId: commentId,
    reason,
  });

  return comment;
}

/**
 * Unhide a comment (set status back to 'active')
 */
export async function unhideComment(adminId: string, commentId: string) {
  const comment = await prisma.comment.update({
    where: { id: commentId },
    data: { status: 'active' },
  });

  await createAuditLog({
    adminId,
    action: 'unhide_comment',
    targetType: 'comment',
    targetId: commentId,
  });

  return comment;
}

/**
 * Ban a user
 */
export async function banUser(adminId: string, userId: string, reason: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      isBanned: true,
      bannedAt: new Date(),
      bannedReason: reason,
    },
  });

  await createAuditLog({
    adminId,
    action: 'ban_user',
    targetType: 'user',
    targetId: userId,
    reason,
  });

  return user;
}

/**
 * Unban a user
 */
export async function unbanUser(adminId: string, userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      isBanned: false,
      bannedAt: null,
      bannedReason: null,
    },
  });

  await createAuditLog({
    adminId,
    action: 'unban_user',
    targetType: 'user',
    targetId: userId,
  });

  return user;
}

/**
 * Resolve a report (mark as reviewed with action taken)
 */
export async function resolveReport(
  adminId: string,
  reportId: string,
  actionTaken: string
) {
  const report = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: 'reviewed',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      actionTaken,
    },
  });

  await createAuditLog({
    adminId,
    action: 'resolve_report',
    targetType: 'report',
    targetId: reportId,
    metadata: { actionTaken },
  });

  return report;
}

/**
 * Dismiss a report (mark as dismissed)
 */
export async function dismissReport(adminId: string, reportId: string, reason?: string) {
  const report = await prisma.report.update({
    where: { id: reportId },
    data: {
      status: 'dismissed',
      reviewedBy: adminId,
      reviewedAt: new Date(),
      actionTaken: 'dismissed',
    },
  });

  await createAuditLog({
    adminId,
    action: 'dismiss_report',
    targetType: 'report',
    targetId: reportId,
    reason,
  });

  return report;
}

/**
 * Get reports with pagination
 */
export async function getReports(params: {
  status?: string;
  cursor?: string;
  limit?: number;
}) {
  const { status, cursor, limit = 20 } = params;

  const reports = await prisma.report.findMany({
    where: {
      ...(status && { status }),
      ...(cursor && { createdAt: { lt: new Date(cursor) } }),
    },
    include: {
      reporter: {
        select: {
          id: true,
          displayName: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          displayName: true,
          fullName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = reports.length > limit;
  const items = hasMore ? reports.slice(0, -1) : reports;
  const nextCursor = hasMore && items.length > 0
    ? items[items.length - 1].createdAt.toISOString()
    : undefined;

  return { items, hasMore, nextCursor };
}

/**
 * Get report details with target content
 */
export async function getReportWithTarget(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: {
        select: {
          id: true,
          displayName: true,
          fullName: true,
          avatarUrl: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          displayName: true,
          fullName: true,
        },
      },
    },
  });

  if (!report) return null;

  // Fetch target content based on type
  let target: unknown = null;

  if (report.targetType === 'post') {
    target = await prisma.post.findUnique({
      where: { id: report.targetId },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });
  } else if (report.targetType === 'comment') {
    target = await prisma.comment.findUnique({
      where: { id: report.targetId },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  } else if (report.targetType === 'user') {
    target = await prisma.user.findUnique({
      where: { id: report.targetId },
      select: {
        id: true,
        displayName: true,
        fullName: true,
        avatarUrl: true,
        bio: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            comments: true,
          },
        },
      },
    });
  }

  return { ...report, target };
}

/**
 * Get admin stats
 */
export async function getAdminStats() {
  const [
    pendingReports,
    totalReports,
    bannedUsers,
    hiddenPosts,
  ] = await Promise.all([
    prisma.report.count({ where: { status: 'pending' } }),
    prisma.report.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.post.count({ where: { status: 'hidden' } }),
  ]);

  return {
    pendingReports,
    totalReports,
    bannedUsers,
    hiddenPosts,
  };
}
