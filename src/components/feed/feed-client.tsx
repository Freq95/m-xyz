'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  likeCount: number;
  isLiked: boolean;
  isSaved: boolean;
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
  selectedFilter?: string;
}

const categories: { value: PostCategory | 'ALL' | 'GRATUIT'; label: string }[] = [
  { value: 'ALL', label: 'Toate' },
  { value: 'ALERT', label: 'Alerte' },
  { value: 'SELL', label: 'Vând' },
  { value: 'GRATUIT', label: 'Gratuit' },
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
  selectedFilter,
}: FeedClientProps) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset state when category changes (props update)
  useEffect(() => {
    setPosts(initialPosts);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
  }, [initialPosts, initialCursor, initialHasMore]);

  // Infinite scroll: Auto-load next page when user scrolls near bottom
  useEffect(() => {
    if (!hasMore || !cursor || !loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoadingMore) {
          handleLoadMore(); // Auto-load instead of just prefetch
        }
      },
      { rootMargin: '4000px' } // Start loading 4000px before reaching bottom
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, cursor, isLoadingMore]);

  const handleCategoryChange = (category: PostCategory | 'ALL' | 'GRATUIT') => {
    if (isPending) return; // Prevent double clicks

    startTransition(() => {
      const params = new URLSearchParams();
      if (category === 'GRATUIT') {
        params.set('filter', 'gratuit');
      } else if (category !== 'ALL') {
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

      if (selectedFilter) {
        params.append('filter', selectedFilter);
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
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => handleCategoryChange(cat.value)}
            aria-label={`Filtrează după ${cat.label}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              (cat.value === 'GRATUIT' && selectedFilter === 'gratuit') ||
              (cat.value !== 'GRATUIT' && !selectedFilter && selectedCategory === cat.value)
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-foreground hover:bg-muted/80 border border-border'
            } ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Empty State or Posts List */}
      {posts.length === 0 ? (
        <EmptyState
          title={
            selectedFilter === 'gratuit'
              ? 'Nu sunt obiecte gratuite momentan'
              : selectedCategory !== 'ALL'
                ? 'Nu sunt postări în categoria selectată'
                : 'Nu sunt postări încă'
          }
          description={
            selectedFilter === 'gratuit'
              ? 'Fii primul care oferă ceva gratuit vecinilor!'
              : selectedCategory !== 'ALL'
                ? 'Încearcă altă categorie sau creează o postare.'
                : 'Fii primul care postează în cartierul tău!'
          }
        />
      ) : (
        <>
          {/* Posts List (Virtual scrolling temporarily disabled due to package installation issues) */}
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {/* Infinite scroll loading indicator */}
          {hasMore && (
            <div ref={loadMoreRef} className="mt-6 text-center py-8">
              {isLoadingMore && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Se încarcă mai multe postări...</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
