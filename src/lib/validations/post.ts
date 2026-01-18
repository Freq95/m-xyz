import { z } from 'zod';

export const postCategoryEnum = z.enum([
  'ALERT',
  'SELL',
  'BUY',
  'SERVICE',
  'QUESTION',
  'EVENT',
  'LOST_FOUND',
]);

export const createPostSchema = z.object({
  title: z.string().max(200, 'Titlul nu poate depăși 200 de caractere').optional(),
  body: z
    .string()
    .min(10, 'Conținutul trebuie să aibă cel puțin 10 caractere')
    .max(5000, 'Conținutul nu poate depăși 5000 de caractere'),
  category: postCategoryEnum,
  priceCents: z
    .number()
    .int()
    .min(0, 'Prețul nu poate fi negativ')
    .max(100000000, 'Prețul este prea mare')
    .optional(),
  isFree: z.boolean().optional(),
});

export const updatePostSchema = createPostSchema.partial().extend({
  status: z.enum(['active', 'sold', 'resolved']).optional(),
});

export const postQuerySchema = z.object({
  neighborhood: z.string().min(1),
  category: postCategoryEnum.optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const searchQuerySchema = z.object({
  q: z.string().min(2, 'Căutarea trebuie să aibă cel puțin 2 caractere').max(100),
  neighborhood: z.string().min(1),
  category: postCategoryEnum.optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type PostCategory = z.infer<typeof postCategoryEnum>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PostQueryInput = z.infer<typeof postQuerySchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
