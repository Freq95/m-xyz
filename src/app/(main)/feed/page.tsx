import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RefreshCw, Settings, MessageSquare } from 'lucide-react';
import { Button, Card, Avatar } from '@/components/ui';
import { FeedClient, FeedSkeleton, NoNeighborhoodState } from '@/components/feed';
import { NotificationBell } from '@/components/layout';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';
import type { PostCategory } from '@/lib/validations/post';

interface PageProps {
  searchParams: Promise<{ category?: string; filter?: string }>;
}

async function getUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      displayName: true,
      avatarUrl: true,
      neighborhood: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return user;
}

async function getPosts(neighborhoodSlug: string, category?: string, filter?: string) {
  // Try cache first - cache ALL queries including filtered categories
  const shouldCache = !!redis;
  const cacheKey = shouldCache
    ? CACHE_KEYS.FEED({
        neighborhoodSlug,
        categorySlug: category,
        filterSlug: filter,
      })
    : null;

  if (shouldCache && cacheKey && redis) {
    const cached = await redis.get<{ posts: any[]; hasMore: boolean; cursor?: string }>(cacheKey);
    if (cached) {
      console.log(`✓ CACHE HIT: ${cacheKey}`);
      return cached;
    }
    console.log(`✗ CACHE MISS: ${cacheKey}`);
  }

  // Find neighborhood
  const neighborhood = await prisma.neighborhood.findUnique({
    where: { slug: neighborhoodSlug },
  });

  if (!neighborhood) {
    return { posts: [], hasMore: false };
  }

  // Fetch posts
  const posts = await prisma.post.findMany({
    where: {
      neighborhoodId: neighborhood.id,
      status: 'active',
      ...(category && category !== 'ALL' && { category }),
      ...(filter === 'gratuit' && {
        category: 'SELL',
        isFree: true,
      }),
    },
    orderBy: [
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 21, // Fetch one extra to check if there are more
    include: {
      author: {
        select: {
          id: true,
          fullName: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      images: {
        orderBy: { position: 'asc' },
        take: 4,
      },
      _count: {
        select: { comments: true },
      },
    },
  });

  const hasMore = posts.length > 20;
  const postsToReturn = hasMore ? posts.slice(0, -1) : posts;
  const cursor = hasMore ? postsToReturn[postsToReturn.length - 1]?.id : undefined;

  const formattedPosts = postsToReturn.map((post) => ({
    id: post.id,
    title: post.title,
    body: post.body,
    category: post.category,
    priceCents: post.priceCents,
    currency: post.currency,
    isFree: post.isFree,
    isPinned: post.isPinned,
    status: post.status,
    commentCount: post._count.comments,
    viewCount: post.viewCount,
    createdAt: post.createdAt.toISOString(),
    author: {
      id: post.author.id,
      name: post.author.displayName || post.author.fullName,
      avatarUrl: post.author.avatarUrl,
    },
    images: post.images.map((img) => ({
      id: img.id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl,
    })),
  }));

  const result = { posts: formattedPosts, hasMore, cursor };

  // Store in cache
  if (shouldCache && cacheKey && redis) {
    await redis.set(cacheKey, result, { ex: CACHE_TTL.FEED });
  }

  return result;
}

async function FeedPosts({ neighborhoodSlug, category, filter }: { neighborhoodSlug: string; category?: string; filter?: string }) {
  const { posts, hasMore, cursor } = await getPosts(neighborhoodSlug, category, filter);

  return (
    <FeedClient
      initialPosts={posts}
      initialCursor={cursor}
      initialHasMore={hasMore}
      neighborhoodSlug={neighborhoodSlug}
      selectedCategory={(category as PostCategory) || 'ALL'}
      selectedFilter={filter}
    />
  );
}

export default async function FeedPage({ searchParams }: PageProps) {
  try {
    const authUser = await getAuthUser();
    const user = await getUserData(authUser.id);

    if (!user) {
      redirect('/login');
    }

    const params = await searchParams;
    const category = params.category;
    const filter = params.filter;

    console.log('🔍 [FEED PAGE] Received params:', { category, filter });

    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">V</span>
              </div>
              <div>
                <span className="font-semibold">Vecinu</span>
                {user.neighborhood && (
                  <p className="text-xs text-muted-foreground">{user.neighborhood.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <form action="/feed">
                <Button variant="ghost" size="sm" type="submit" aria-label="Reîmprospătează feed-ul">
                  <RefreshCw className="w-5 h-5" />
                </Button>
              </form>
              <NotificationBell />
              <Link href="/messages">
                <Button variant="ghost" size="sm" aria-label="Mesaje">
                  <MessageSquare className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="sm" aria-label="Deschide setările">
                  <Settings className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-4xl px-4 py-4 pb-24">
          {/* Create Post Button */}
          <Card className="p-4 mb-4">
            <div className="flex items-center gap-3">
              <Avatar
                fallback={user.displayName || user.fullName || 'EU'}
                src={user.avatarUrl}
                size="md"
              />
              <Link
                href="/post/new"
                className="flex-1 text-left px-4 py-2 bg-secondary rounded-full text-muted-foreground text-sm hover:bg-secondary/80 transition-colors"
              >
                Ce se întâmplă în cartier?
              </Link>
            </div>
          </Card>

          {/* Content */}
          {!user.neighborhood ? (
            <NoNeighborhoodState />
          ) : (
            <Suspense fallback={<FeedSkeleton />}>
              <FeedPosts neighborhoodSlug={user.neighborhood.slug} category={category} filter={filter} />
            </Suspense>
          )}
        </main>
      </div>
    );
  } catch (error) {
    redirect('/login');
  }
}
