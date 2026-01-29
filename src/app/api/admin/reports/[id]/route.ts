import { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { NotFoundError, ValidationError, RateLimitError } from '@/lib/errors';
import { getAdminUser } from '@/lib/auth';
import { validateOrigin } from '@/lib/csrf';
import {
  getReportWithTarget,
  resolveReport,
  dismissReport,
} from '@/lib/services/admin.service';
import { adminRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const updateReportSchema = z.object({
  action: z.enum(['resolve', 'dismiss']),
  actionTaken: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * GET /api/admin/reports/[id] - Get report details (admin only)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAdminUser();

    // Check rate limit
    if (adminRateLimit) {
      const { success } = await adminRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Ai atins limita de cereri. Încearcă din nou mai târziu.');
      }
    }

    const { id } = await params;
    const report = await getReportWithTarget(id);

    if (!report) {
      throw new NotFoundError('Raportul');
    }

    return successResponse({ report });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/admin/reports/[id] - Update report status (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateOrigin(request)) {
      throw new ValidationError('Cerere invalidă');
    }

    const admin = await getAdminUser();

    // Check rate limit
    if (adminRateLimit) {
      const { success } = await adminRateLimit.limit(admin.id);
      if (!success) {
        throw new RateLimitError('Ai atins limita de cereri. Încearcă din nou mai târziu.');
      }
    }

    const { id } = await params;

    const body = await request.json();
    const data = updateReportSchema.parse(body);

    let report;
    if (data.action === 'resolve') {
      report = await resolveReport(admin.id, id, data.actionTaken || 'resolved');
    } else {
      report = await dismissReport(admin.id, id, data.reason);
    }

    return successResponse({ report });
  } catch (error) {
    return handleApiError(error);
  }
}
