'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, Bookmark, ShoppingBag, User, Plus, RefreshCw } from 'lucide-react';
import { Button, Card, Avatar } from '@/components/ui';
import { PostCard, FeedSkeleton, EmptyState, NoNeighborhoodState } from '@/components/feed';
import { NotificationBell } from '@/components/layout';
import type { PostCategory } from '@/lib/validations/post';

interface Post {
  id: string;
  title: string | null;
  body: string;
  category: PostCategory;
  priceCents: number | null;
  currency: string;
  isFree: boolean;
  isPinned: boolean;
  status: string;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl: string | null;
  }>;
}

interface UserData {
  id: string;
  fullName: string;
  displayName: string | null;
  avatarUrl: string | null;
  neighborhood: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

const categories: { value: PostCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Toate' },
  { value: 'ALERT', label: 'Alerte' },
  { value: 'SELL', label: 'Vând' },
  { value: 'BUY', label: 'Cumpăr' },
  { value: 'SERVICE', label: 'Servicii' },
  { value: 'QUESTION', label: 'Întrebări' },
  { value: 'EVENT', label: 'Evenimente' },
  { value: 'LOST_FOUND', label: 'Pierdut/Găsit' },
];

export default function FeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PostCategory | 'ALL'>('ALL');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  // Fetch current user
  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const result = await response.json();
          // API returns { data: { user: {...} } }
          const userData = result.data?.user || null;
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          // Not authenticated - redirect to login
          setIsAuthenticated(false);
          router.push('/login');
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
        setIsAuthenticated(false);
        router.push('/login');
      }
    }
    fetchUser();
  }, [router]);

  // Fetch posts
  const fetchPosts = useCallback(async (reset = true, currentCursor?: string) => {
    if (!user?.neighborhood?.slug) return;

    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        neighborhood: user.neighborhood.slug,
        limit: '20',
      });

      if (selectedCategory !== 'ALL') {
        params.append('category', selectedCategory);
      }

      if (!reset && currentCursor) {
        params.append('cursor', currentCursor);
      }

      const response = await fetch(`/api/posts?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch posts');
      }

      if (reset) {
        setPosts(result.data);
      } else {
        setPosts((prev) => [...prev, ...result.data]);
      }

      setCursor(result.meta?.cursor);
      setHasMore(result.meta?.hasMore || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [user?.neighborhood?.slug, selectedCategory]);

  // Initial fetch and when category changes
  useEffect(() => {
    if (user?.neighborhood?.slug) {
      setCursor(undefined);
      fetchPosts(true);
    } else if (isAuthenticated === true && user && !user.neighborhood) {
      // User is authenticated but has no neighborhood
      setIsLoading(false);
    }
  }, [user?.neighborhood?.slug, selectedCategory, isAuthenticated, fetchPosts]);

  const handleCategoryChange = (category: PostCategory | 'ALL') => {
    setSelectedCategory(category);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && cursor) {
      fetchPosts(false, cursor);
    }
  };

  const handleRefresh = () => {
    setCursor(undefined);
    fetchPosts(true);
  };

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
              {user?.neighborhood && (
                <p className="text-xs text-muted-foreground">{user.neighborhood.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
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
              fallback={user?.displayName || user?.fullName || 'EU'}
              src={user?.avatarUrl}
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

        {/* Category Filter Tabs */}
        {user?.neighborhood && (
          <div className="flex gap-1.5 mb-4 justify-between">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => handleCategoryChange(cat.value)}
                className={`px-2 py-1 rounded-full text-xs transition-colors ${
                  selectedCategory === cat.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {isLoading || isAuthenticated === null ? (
          <FeedSkeleton />
        ) : isAuthenticated && user && !user.neighborhood ? (
          <NoNeighborhoodState />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={handleRefresh}>Încearcă din nou</Button>
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            title={selectedCategory === 'ALL' ? 'Nu sunt postări încă' : `Nu sunt postări în categoria "${categories.find(c => c.value === selectedCategory)?.label}"`}
            description={selectedCategory === 'ALL' ? 'Fii primul care postează în cartierul tău!' : 'Încearcă altă categorie sau creează o postare.'}
          />
        ) : (
          <>
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-6 text-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  isLoading={isLoadingMore}
                >
                  {isLoadingMore ? 'Se încarcă...' : 'Mai multe postări'}
                </Button>
              </div>
            )}
          </>
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
            {user?.id ? (
              <Link href={`/profile/${user.id}`} className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground hover:text-primary transition-colors">
                <User className="w-5 h-5" />
                <span className="text-xs">Profil</span>
              </Link>
            ) : (
              <button
                className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground opacity-50 cursor-not-allowed"
                disabled
              >
                <User className="w-5 h-5" />
                <span className="text-xs">Profil</span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
