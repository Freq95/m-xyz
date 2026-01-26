import { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { ValidationError } from '@/lib/errors';
import { getAdminUser } from '@/lib/auth';
import { validateOrigin } from '@/lib/csrf';
import { hideComment, unhideComment } from '@/lib/services/admin.service';
import { z } from 'zod';

const updateCommentSchema = z.object({
  action: z.enum(['hide', 'unhide']),
  reason: z.string().optional(),
});

/**
 * PATCH /api/admin/comments/[id] - Hide/unhide comment (admin only)
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
    const { id } = await params;

    const body = await request.json();
    const data = updateCommentSchema.parse(body);

    let comment;
    if (data.action === 'hide') {
      comment = await hideComment(admin.id, id, data.reason);
    } else {
      comment = await unhideComment(admin.id, id);
    }

    return successResponse({ comment });
  } catch (error) {
    return handleApiError(error);
  }
}
