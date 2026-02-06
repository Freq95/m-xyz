import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
} from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { validateOrigin } from '@/lib/csrf';
import { invalidateBlockCache } from '@/lib/services/block.service';
import { saveRateLimit } from '@/lib/rate-limit';

// CRITICAL: Disable ALL Next.js caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/[id]/block - Check if current user has blocked this user
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: targetUserId } = await context.params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('Supabase auth error in GET block:', authError);
      throw new AuthenticationError();
    }

    if (!user) {
      console.error('No user in GET block');
      throw new AuthenticationError();
    }

    console.log('GET block - user.id:', user.id, 'targetUserId:', targetUserId);

    // Can't block yourself
    if (user.id === targetUserId) {
      return successResponse({ isBlocked: false });
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new NotFoundError('Utilizator');
    }

    // Check if current user has blocked target user
    const block = await prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: user.id,
          blockedId: targetUserId,
        },
      },
    });

    // Create response with no-cache headers to prevent stale data
    const response = successResponse({
      isBlocked: !!block,
    });

    // Add cache-control headers to prevent browser/Next.js caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/users/[id]/block - Block a user
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    const { id: targetUserId } = await context.params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    // Rate limiting: 60 blocks per hour (same as saves)
    if (saveRateLimit) {
      const { success } = await saveRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Prea multe acțiuni. Încearcă din nou mai târziu.');
      }
    }

    // Can't block yourself
    if (user.id === targetUserId) {
      throw new ValidationError('Nu te poți bloca pe tine însuți');
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new NotFoundError('Utilizator');
    }

    // Create block (idempotent - no error if already blocked)
    await prisma.blockedUser.createMany({
      data: {
        blockerId: user.id,
        blockedId: targetUserId,
      },
      skipDuplicates: true,
    });

    // Invalidate cache for the blocker
    await invalidateBlockCache(user.id);

    return successResponse({
      blocked: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/users/[id]/block - Unblock a user
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    // CSRF protection
    if (!validateOrigin(request)) {
      throw new AuthorizationError('Cerere invalidă');
    }

    const { id: targetUserId } = await context.params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AuthenticationError();
    }

    // Rate limiting: 60 unblocks per hour (same as saves)
    if (saveRateLimit) {
      const { success } = await saveRateLimit.limit(user.id);
      if (!success) {
        throw new RateLimitError('Prea multe acțiuni. Încearcă din nou mai târziu.');
      }
    }

    // Delete block (idempotent - no error if not blocked)
    await prisma.blockedUser.deleteMany({
      where: {
        blockerId: user.id,
        blockedId: targetUserId,
      },
    });

    // Invalidate cache for the blocker
    await invalidateBlockCache(user.id);

    return successResponse({
      blocked: false,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
