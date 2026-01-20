import { z } from 'zod';

/**
 * Validation schema for neighborhood selection
 */
export const selectNeighborhoodSchema = z.object({
  neighborhoodId: z.string().uuid('ID cartier invalid'),
});

export type SelectNeighborhoodInput = z.infer<typeof selectNeighborhoodSchema>;
