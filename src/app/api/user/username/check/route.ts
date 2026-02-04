import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';
import { usernameSchema } from '@/lib/validations/settings';

/**
 * GET /api/user/username/check?username=example
 * Check if a username is available
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username lipsă' },
        { status: 400 }
      );
    }

    // Validate username format
    const validation = usernameSchema.safeParse(username);
    if (!validation.success) {
      return NextResponse.json(
        {
          available: false,
          error: validation.error.errors[0]?.message || 'Username invalid'
        },
        { status: 200 }
      );
    }

    const normalizedUsername = validation.data;

    // Check if username exists (excluding current user)
    const existingUser = await prisma.user.findFirst({
      where: {
        username: normalizedUsername,
        NOT: {
          id: user.id,
        },
      },
      select: { id: true },
    });

    return NextResponse.json({
      available: !existingUser,
      username: normalizedUsername,
    });
  } catch (error) {
    console.error('Username check error:', error);
    return NextResponse.json(
      { error: 'Eroare la verificarea username-ului' },
      { status: 500 }
    );
  }
}
