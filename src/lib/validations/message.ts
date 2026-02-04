import { z } from 'zod';

export const sendMessageSchema = z.object({
  recipientId: z.string().uuid('ID invalid'),
  body: z.string().min(1, 'Mesajul nu poate fi gol').max(500, 'Mesajul este prea lung'),
});

export const messageQuerySchema = z.object({
  conversationId: z.string().uuid(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const conversationQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageQueryInput = z.infer<typeof messageQuerySchema>;
export type ConversationQueryInput = z.infer<typeof conversationQuerySchema>;
