import { z } from 'zod';

/**
 * No additional validation needed for POST/DELETE block
 * userId comes from URL params
 */

/**
 * Query params for checking block status
 */
export const blockStatusSchema = z.object({
  userId: z.string().uuid('ID utilizator invalid'),
});

export type BlockStatusQuery = z.infer<typeof blockStatusSchema>;
