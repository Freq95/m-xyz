'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
// import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui';
import { PostCard, EmptyState } from '@/components/feed';
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

interface FeedClientProps {
  initialPosts: Post[];
  initialCursor?: string;
  initialHasMore: boolean;
  neighborhoodSlug: string;
  selectedCategory?: PostCategory | 'ALL';
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

export function FeedClient({
  initialPosts,
  initialCursor,
  initialHasMore,
  neighborhoodSlug,
  selectedCategory = 'ALL',
}: FeedClientProps) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPrefetching, setIsPrefetching] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  // const parentRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling for posts list (commented out - package installation issue)
  // const virtualizer = useVirtualizer({
  //   count: posts.length,
  //   getScrollElement: () => parentRef.current,
  //   estimateSize: () => 350, // Estimated height of a PostCard
  //   overscan: 3, // Render 3 items above and below viewport
  // });

  // Reset state when category changes (props update)
  useEffect(() => {
    setPosts(initialPosts);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
  }, [initialPosts, initialCursor, initialHasMore]);

  // Prefetch next page when user scrolls near "Load More" button
  useEffect(() => {
    if (!hasMore || !cursor || !loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoadingMore && !isPrefetching) {
          prefetchNextPage();
        }
      },
      { rootMargin: '200px' } // Start prefetching 200px before button is visible
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, cursor, isLoadingMore, isPrefetching]);

  const prefetchNextPage = async () => {
    if (!cursor || isPrefetching) return;

    setIsPrefetching(true);
    try {
      const params = new URLSearchParams({
        neighborhood: neighborhoodSlug,
        cursor,
        limit: '20',
      });

      if (selectedCategory !== 'ALL') {
        params.append('category', selectedCategory);
      }

      // Prefetch using fetch with low priority
      fetch(`/api/posts?${params}`, { priority: 'low' as any });
    } catch (err) {
      // Silent fail for prefetch
    } finally {
      setIsPrefetching(false);
    }
  };

  const handleCategoryChange = (category: PostCategory | 'ALL') => {
    if (isPending) return; // Prevent double clicks

    startTransition(() => {
      const params = new URLSearchParams();
      if (category !== 'ALL') {
        params.set('category', category);
      }
      router.push(`/feed?${params.toString()}`);
      // Removed router.refresh() - let Next.js use cache naturally
    });
  };

  const handleLoadMore = async () => {
    if (!cursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({
        neighborhood: neighborhoodSlug,
        cursor,
        limit: '20',
      });

      if (selectedCategory !== 'ALL') {
        params.append('category', selectedCategory);
      }

      const response = await fetch(`/api/posts?${params}`);
      const result = await response.json();

      if (response.ok) {
        setPosts((prev) => [...prev, ...result.data]);
        setCursor(result.meta?.cursor);
        setHasMore(result.meta?.hasMore || false);
      }
    } catch (err) {
      console.error('Failed to load more posts:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <>
      {/* Category Filter Tabs */}
      <div className="flex gap-1.5 mb-4 justify-between">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => handleCategoryChange(cat.value)}
            className={`px-2 py-1 rounded-full text-xs transition-colors ${
              selectedCategory === cat.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            } ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Empty State or Posts List */}
      {posts.length === 0 ? (
        <EmptyState
          title={selectedCategory !== 'ALL' ? 'Nu sunt postări în categoria selectată' : 'Nu sunt postări încă'}
          description={selectedCategory !== 'ALL' ? 'Încearcă altă categorie sau creează o postare.' : 'Fii primul care postează în cartierul tău!'}
        />
      ) : (
        <>
          {/* Posts List (Virtual scrolling temporarily disabled due to package installation issues) */}
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div ref={loadMoreRef} className="mt-6 text-center">
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
    </>
  );
}
