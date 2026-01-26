import { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { getAdminUser } from '@/lib/auth';
import { getAdminStats } from '@/lib/services/admin.service';

/**
 * GET /api/admin/stats - Get admin dashboard stats
 */
export async function GET(_request: NextRequest) {
  try {
    await getAdminUser();

    const stats = await getAdminStats();

    return successResponse({ stats });
  } catch (error) {
    return handleApiError(error);
  }
}
