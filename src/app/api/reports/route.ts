import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { AuthenticationError, ValidationError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin } from '@/lib/csrf';
import { z } from 'zod';

const createReportSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  targetId: z.string().uuid(),
  reason: z.string().min(5, 'Motivul trebuie să aibă cel puțin 5 caractere').max(1000),
  details: z.string().max(2000).optional(),
});

/**
 * POST /api/reports - Create a new report
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new ValidationError('Cerere invalidă');
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    const body = await request.json();
    const data = createReportSchema.parse(body);

    // Check if user already reported this target
    const existingReport = await prisma.report.findFirst({
      where: {
        reporterId: user.id,
        targetType: data.targetType,
        targetId: data.targetId,
        status: { in: ['pending', 'reviewed'] },
      },
    });

    if (existingReport) {
      return successResponse({
        reported: true,
        message: 'Ai raportat deja acest conținut'
      });
    }

    // Create the report
    const report = await prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: data.targetType,
        targetId: data.targetId,
        reason: data.reason,
        details: data.details,
      },
    });

    return successResponse({
      reported: true,
      reportId: report.id,
      message: 'Raportul a fost trimis. Mulțumim!'
    });
  } catch (error) {
    return handleApiError(error);
  }
}
