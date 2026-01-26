import { z } from 'zod';

export const createCommentSchema = z.object({
  postId: z.string().uuid('ID-ul postării este invalid'),
  parentId: z.string().uuid('ID-ul comentariului părinte este invalid').optional(),
  body: z
    .string()
    .min(1, 'Comentariul nu poate fi gol')
    .max(2000, 'Comentariul nu poate depăși 2000 de caractere'),
});

export const updateCommentSchema = z.object({
  body: z
    .string()
    .min(1, 'Comentariul nu poate fi gol')
    .max(2000, 'Comentariul nu poate depăși 2000 de caractere'),
});

export const commentQuerySchema = z.object({
  postId: z.string().uuid(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type CommentQueryInput = z.infer<typeof commentQuerySchema>;
