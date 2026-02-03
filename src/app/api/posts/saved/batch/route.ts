import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';

/**
 * GET /api/posts/saved/batch?postIds=id1,id2,id3
 * Fetch saved status for multiple posts in a single request
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const postIdsParam = searchParams.get('postIds');

    if (!postIdsParam) {
      return NextResponse.json(
        { error: 'postIds parameter is required' },
        { status: 400 }
      );
    }

    // Parse post IDs from comma-separated string
    const postIds = postIdsParam.split(',').filter(Boolean);

    if (postIds.length === 0) {
      return NextResponse.json({ data: {} });
    }

    // Limit to 100 posts per request to prevent abuse
    if (postIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 post IDs allowed per request' },
        { status: 400 }
      );
    }

    // Fetch all saved posts for this user that match the post IDs
    const savedPosts = await prisma.savedPost.findMany({
      where: {
        userId: authUser.id,
        postId: { in: postIds },
      },
      select: {
        postId: true,
      },
    });

    // Create a map of postId -> true for saved posts
    const savedMap: Record<string, boolean> = {};
    postIds.forEach((postId) => {
      savedMap[postId] = false; // Default to false
    });
    savedPosts.forEach((saved) => {
      savedMap[saved.postId] = true; // Mark as saved
    });

    return NextResponse.json({
      data: savedMap,
      meta: {
        total: postIds.length,
        saved: savedPosts.length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch saved posts batch:', error);
    return NextResponse.json(
      { error: 'Failed to fetch saved posts' },
      { status: 500 }
    );
  }
}
