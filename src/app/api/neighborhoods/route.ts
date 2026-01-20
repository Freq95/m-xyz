import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma/client';
import { handleApiError, successResponse } from '@/lib/errors/handler';

/**
 * GET /api/neighborhoods
 * Fetches active neighborhoods (Timișoara pilot)
 */
export async function GET(request: NextRequest) {
  try {
    const neighborhoods = await prisma.neighborhood.findMany({
      where: {
        isActive: true,
        city: 'Timișoara', // Pilot focus
      },
      select: {
        id: true,
        name: true,
        city: true,
        slug: true,
        description: true,
        memberCount: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return successResponse({ neighborhoods });
  } catch (error) {
    return handleApiError(error);
  }
}
