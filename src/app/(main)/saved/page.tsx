'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { Button, Card, Skeleton } from '@/components/ui';
import { PostCard } from '@/components/feed';
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
  commentCount: number;
  viewCount: number;
  createdAt: string;
  savedAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  neighborhood: {
    id: string;
    name: string;
    slug: string;
  };
  images: Array<{
    id: string;
    url: string;
    thumbnailUrl: string | null;
  }>;
}

export default function SavedPostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Fetch saved posts
  const fetchSavedPosts = useCallback(async (reset = true) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({ limit: '20' });
      if (!reset && cursor) {
        params.append('cursor', cursor);
      }

      const response = await fetch(`/api/posts/saved?${params}`);

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const result = await response.json();

      if (response.ok) {
        if (reset) {
          setPosts(result.data || []);
        } else {
          setPosts((prev) => [...prev, ...(result.data || [])]);
        }
        setCursor(result.meta?.cursor);
        setHasMore(result.meta?.hasMore || false);
      }
    } catch (err) {
      console.error('Failed to fetch saved posts:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [cursor, router]);

  useEffect(() => {
    setCursor(undefined);
    fetchSavedPosts(true);
  }, []);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchSavedPosts(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Link href="/feed">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <span className="font-semibold">Postări salvate</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center">
            <Bookmark className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <h2 className="font-semibold mb-2">Nu ai postări salvate</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Când găsești o postare interesantă, apasă pe iconița de salvare pentru a o adăuga aici.
            </p>
            <Link href="/feed">
              <Button>Explorează feed-ul</Button>
            </Link>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

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
    </div>
  );
}
