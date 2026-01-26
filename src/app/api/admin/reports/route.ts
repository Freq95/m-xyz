import { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { getAdminUser } from '@/lib/auth';
import { getReports } from '@/lib/services/admin.service';

/**
 * GET /api/admin/reports - Get reports list (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    await getAdminUser();

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
