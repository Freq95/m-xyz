import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';

/**
 * GET /api/users/search?q=query&limit=10
 * Search users by username or displayName
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Termenul de căutare trebuie să aibă minim 2 caractere' },
        { status: 400 }
      );
    }

    // Search users by username or displayName (case-insensitive)
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                username: {
                  contains: query.toLowerCase(),
                  mode: 'insensitive',
                },
              },
              {
                displayName: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            ],
          },
          {
            isBanned: false, // Exclude banned users
          },
          {
            NOT: {
              id: user.id, // Exclude current user from search results
            },
          },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        neighborhood: {
          select: {
            name: true,
            city: true,
          },
        },
      },
      take: Math.min(limit, 50), // Max 50 results
      orderBy: [
        { username: 'asc' }, // Prioritize username matches
      ],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('User search error:', error);
    return NextResponse.json(
      { error: 'Eroare la căutarea utilizatorilor' },
      { status: 500 }
    );
  }
}
