'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, Button, Avatar } from '@/components/ui';
import { FileText, Eye, EyeOff, ExternalLink, Search } from 'lucide-react';

interface Post {
  id: string;
  title: string | null;
  body: string;
  category: string;
  status: string;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  _count: {
    comments: number;
  };
}

const categoryLabels: Record<string, string> = {
  ALERT: 'Alertă',
  SELL: 'Vând',
  BUY: 'Cumpăr',
  SERVICE: 'Servicii',
  QUESTION: 'Întrebare',
  EVENT: 'Eveniment',
  LOST_FOUND: 'Pierdut/Găsit',
  GENERAL: 'General',
};

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'hidden' | 'active'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('filter', filter);
      if (searchQuery) params.append('q', searchQuery);

      const response = await fetch(`/api/admin/posts?${params}`);
      if (response.ok) {
        const result = await response.json();
        setPosts(result.data.posts);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    fetchPosts();
  }, [filter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPosts();
  };

  const handleToggleVisibility = async (postId: string, currentlyHidden: boolean) => {
    setActionLoading(postId);
    try {
      const response = await fetch(`/api/admin/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: currentlyHidden ? 'unhide' : 'hide' }),
      });

      if (response.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Postări</h1>

        {/* Filter */}
        <div className="flex gap-2">
          {(['all', 'active', 'hidden'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Toate' : f === 'active' ? 'Active' : 'Ascunse'}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Caută după titlu sau conținut..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </form>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-secondary rounded w-1/3 mb-2" />
              <div className="h-3 bg-secondary rounded w-2/3" />
            </Card>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nu s-au găsit postări</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <Card key={post.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-secondary rounded text-xs">
                      {categoryLabels[post.category] || post.category}
                    </span>
                    {post.status === 'hidden' && (
                      <span className="px-2 py-0.5 bg-gray-500/10 text-gray-500 rounded text-xs">
                        Ascuns
                      </span>
                    )}
                    {post.status === 'sold' && (
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded text-xs">
                        Vândut
                      </span>
                    )}
                  </div>

                  <h3 className="font-medium mb-1">
                    {post.title || post.body.substring(0, 60) + (post.body.length > 60 ? '...' : '')}
                  </h3>

                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {post.body}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Avatar
                        src={post.author.avatarUrl}
                        fallback={post.author.displayName || post.author.fullName}
                        size="xs"
                      />
                      <span>{post.author.displayName || post.author.fullName}</span>
                    </div>
                    <span>{post._count.comments} comentarii</span>
                    <span>{formatDate(post.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/post/${post.id}`}
                    target="_blank"
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleVisibility(post.id, post.status === 'hidden')}
                    isLoading={actionLoading === post.id}
                    disabled={!!actionLoading}
                  >
                    {post.status === 'hidden' ? (
                      <>
                        <Eye className="w-4 h-4 mr-1" />
                        Afișează
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4 mr-1" />
                        Ascunde
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
