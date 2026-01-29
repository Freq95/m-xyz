import { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { getAdminUser } from '@/lib/auth';
import { getReports } from '@/lib/services/admin.service';
import { adminRateLimit } from '@/lib/rate-limit';
import { RateLimitError } from '@/lib/errors';

/**
 * GET /api/admin/reports - Get reports list (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAdminUser();

    // Check rate limit
    if (adminRateLimit) {
      const { success } = await adminRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Ai atins limita de cereri. Încearcă din nou mai târziu.');
      }
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const { items, hasMore, nextCursor } = await getReports({
      status,
      cursor,
      limit: Math.min(limit, 50),
    });

    return successResponse(
      { reports: items },
      { cursor: nextCursor, hasMore }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
