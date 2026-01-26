import { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { ValidationError } from '@/lib/errors';
import { getAdminUser } from '@/lib/auth';
import { validateOrigin } from '@/lib/csrf';
import { banUser, unbanUser } from '@/lib/services/admin.service';
import { z } from 'zod';

const updateUserSchema = z.object({
  action: z.enum(['ban', 'unban']),
  reason: z.string().min(5, 'Motivul trebuie să aibă cel puțin 5 caractere').optional(),
});

/**
 * PATCH /api/admin/users/[id] - Ban/unban user (admin only)
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

    // Prevent admin from banning themselves
    if (id === admin.id) {
      throw new ValidationError('Nu te poți suspenda singur');
    }

    const body = await request.json();
    const data = updateUserSchema.parse(body);

    let user;
    if (data.action === 'ban') {
      if (!data.reason) {
        throw new ValidationError('Motivul este obligatoriu pentru suspendare');
      }
      user = await banUser(admin.id, id, data.reason);
    } else {
      user = await unbanUser(admin.id, id);
    }

    return successResponse({
      user: {
        id: user.id,
        isBanned: user.isBanned,
        bannedAt: user.bannedAt,
        bannedReason: user.bannedReason,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
