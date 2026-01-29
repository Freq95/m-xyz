import { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { getAdminUser } from '@/lib/auth';
import { getAdminStats } from '@/lib/services/admin.service';
import { adminRateLimit } from '@/lib/rate-limit';
import { RateLimitError } from '@/lib/errors';

/**
 * GET /api/admin/stats - Get admin dashboard stats
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await getAdminUser();

    // Check rate limit
    if (adminRateLimit) {
      const { success } = await adminRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Ai atins limita de cereri. Încearcă din nou mai târziu.');
      }
    }

    const stats = await getAdminStats();

    return successResponse({ stats });
  } catch (error) {
    return handleApiError(error);
  }
}
