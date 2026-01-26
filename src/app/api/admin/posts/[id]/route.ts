import { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { ValidationError } from '@/lib/errors';
import { getAdminUser } from '@/lib/auth';
import { validateOrigin } from '@/lib/csrf';
import { hidePost, unhidePost } from '@/lib/services/admin.service';
import { z } from 'zod';

const updatePostSchema = z.object({
  action: z.enum(['hide', 'unhide']),
  reason: z.string().optional(),
});

/**
 * PATCH /api/admin/posts/[id] - Hide/unhide post (admin only)
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
    const data = updatePostSchema.parse(body);

    let post;
    if (data.action === 'hide') {
      post = await hidePost(admin.id, id, data.reason);
    } else {
      post = await unhidePost(admin.id, id);
    }

    return successResponse({ post });
  } catch (error) {
    return handleApiError(error);
  }
}
