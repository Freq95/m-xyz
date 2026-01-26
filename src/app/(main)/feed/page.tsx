import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Home, Bookmark, ShoppingBag, User, Plus, RefreshCw } from 'lucide-react';
import { Button, Card, Avatar } from '@/components/ui';
import { FeedClient, FeedSkeleton, NoNeighborhoodState } from '@/components/feed';
import { NotificationBell } from '@/components/layout';
import { getAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma/client';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';
import type { PostCategory } from '@/lib/validations/post';

interface PageProps {
  searchParams: { category?: string };
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

async function getPosts(neighborhoodSlug: string, category?: string) {
  // Try cache first - cache ALL queries including filtered categories
  const shouldCache = !!redis;
  const cacheKey = shouldCache
    ? CACHE_KEYS.FEED({
        neighborhoodSlug,
        categorySlug: category,
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

async function FeedPosts({ neighborhoodSlug, category }: { neighborhoodSlug: string; category?: string }) {
  const { posts, hasMore, cursor } = await getPosts(neighborhoodSlug, category);

  return (
    <FeedClient
      initialPosts={posts}
      initialCursor={cursor}
      initialHasMore={hasMore}
      neighborhoodSlug={neighborhoodSlug}
      selectedCategory={(category as PostCategory) || 'ALL'}
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

    const category = searchParams.category;

    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
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
                <Button variant="ghost" size="sm" type="submit">
                  <RefreshCw className="w-5 h-5" />
                </Button>
              </form>
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-2xl px-4 py-4 pb-24">
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
              <FeedPosts neighborhoodSlug={user.neighborhood.slug} category={category} />
            </Suspense>
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
          <div className="mx-auto max-w-2xl px-4">
            <div className="flex items-center justify-around py-2">
              <Link href="/feed" className="flex flex-col items-center gap-1 px-4 py-2 text-primary">
                <Home className="w-5 h-5" />
                <span className="text-xs">Acasă</span>
              </Link>
              <button
                className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground opacity-50 cursor-not-allowed"
                title="În curând"
                disabled
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="text-xs">Piață</span>
              </button>
              <Link
                href="/post/new"
                className="flex items-center justify-center w-12 h-12 -mt-4 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-6 h-6" />
              </Link>
              <Link href="/saved" className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground hover:text-primary transition-colors">
                <Bookmark className="w-5 h-5" />
                <span className="text-xs">Salvate</span>
              </Link>
              <Link href={`/profile/${user.id}`} className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground hover:text-primary transition-colors">
                <User className="w-5 h-5" />
                <span className="text-xs">Profil</span>
              </Link>
            </div>
          </div>
        </nav>
      </div>
    );
  } catch (error) {
    redirect('/login');
  }
}
