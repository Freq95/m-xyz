import { z } from 'zod';

export const notificationTypeEnum = z.enum([
  'NEW_COMMENT',      // Someone commented on your post
  'COMMENT_REPLY',    // Someone replied to your comment
  'POST_SOLD',        // Your post was marked as sold (for buyers who saved it)
]);

export const notificationQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.coerce.boolean().optional().default(false),
});

export type NotificationType = z.infer<typeof notificationTypeEnum>;
export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;
