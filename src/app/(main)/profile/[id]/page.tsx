'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { ArrowLeft, MapPin, Calendar, MessageSquare, FileText } from 'lucide-react';
import { Button, Card, Avatar, Skeleton, Textarea, Input } from '@/components/ui';
import { PostCard } from '@/components/feed';
import type { PostCategory } from '@/lib/validations/post';

interface UserProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  joinedAt: string;
  neighborhood: {
    id: string;
    name: string;
    slug: string;
  } | null;
  stats: {
    postCount: number;
    commentCount: number;
  };
}

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

interface CurrentUser {
  id: string;
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Fetch current user
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const result = await response.json();
          setCurrentUser(result.data?.user || null);
        }
      } catch (err) {
        console.error('Failed to fetch current user:', err);
      }
    }
    fetchCurrentUser();
  }, []);

  // Fetch profile
  useEffect(() => {
    async function fetchProfile() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${userId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Profilul nu a fost găsit');
        }

        setProfile(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'A apărut o eroare');
      } finally {
        setIsLoading(false);
      }
    }

    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  // Fetch posts
  const fetchPosts = useCallback(async (reset = true, currentCursor?: string) => {
    if (!userId) return;

    if (reset) {
      setIsLoadingPosts(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({ limit: '10' });
      if (!reset && currentCursor) {
        params.append('cursor', currentCursor);
      }

      const response = await fetch(`/api/users/${userId}/posts?${params}`);
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
      console.error('Failed to fetch posts:', err);
    } finally {
      setIsLoadingPosts(false);
      setIsLoadingMore(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      setCursor(undefined);
      fetchPosts(true);
    }
  }, [userId, fetchPosts]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && cursor) {
      fetchPosts(false, cursor);
    }
  };

  const isOwnProfile = currentUser?.id === userId;

  // Open edit modal
  const openEditModal = () => {
    if (profile) {
      setEditDisplayName(profile.name || '');
      setEditBio(profile.bio || '');
      setShowEditModal(true);
    }
  };

  // Handle profile update
  const handleEditProfile = async () => {
    setIsEditing(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: editDisplayName.trim() || undefined,
          bio: editBio.trim() || undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Update profile with new data
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                name: result.data.name,
                bio: result.data.bio,
              }
            : null
        );
        setShowEditModal(false);
      } else {
        const result = await response.json();
        alert(result.error || 'Nu s-a putut actualiza profilul');
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert('A apărut o eroare');
    } finally {
      setIsEditing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <span className="font-semibold">Profil</span>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className="text-destructive mb-4">{error || 'Profilul nu a fost găsit'}</p>
          <Link href="/feed">
            <Button>Înapoi la feed</Button>
          </Link>
        </main>
      </div>
    );
  }

  const joinedDate = formatDistanceToNow(new Date(profile.joinedAt), {
    addSuffix: true,
    locale: ro,
  });

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <span className="font-semibold">Profil</span>
          </div>
          {isOwnProfile && (
            <Button variant="outline" size="sm" onClick={openEditModal}>
              Editează
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {/* Profile Card */}
        <Card className="p-6 mb-6">
          <div className="flex items-start gap-4">
            <Avatar fallback={profile.name} src={profile.avatarUrl} size="lg" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold mb-1">{profile.name}</h1>

              {profile.bio && (
                <p className="text-sm text-muted-foreground mb-3">{profile.bio}</p>
              )}

              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {profile.neighborhood && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.neighborhood.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Membru {joinedDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 mt-6 pt-4 border-t border-border">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <FileText className="w-4 h-4" />
              </div>
              <p className="text-lg font-semibold">{profile.stats.postCount}</p>
              <p className="text-xs text-muted-foreground">Postări</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <MessageSquare className="w-4 h-4" />
              </div>
              <p className="text-lg font-semibold">{profile.stats.commentCount}</p>
              <p className="text-xs text-muted-foreground">Comentarii</p>
            </div>
          </div>
        </Card>

        {/* Posts Section */}
        <div>
          <h2 className="font-semibold mb-4">Postări ({profile.stats.postCount})</h2>

          {isLoadingPosts ? (
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
              <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isOwnProfile ? 'Nu ai nicio postare încă.' : 'Acest utilizator nu are postări încă.'}
              </p>
              {isOwnProfile && (
                <Link href="/post/new" className="inline-block mt-4">
                  <Button size="sm">Creează prima postare</Button>
                </Link>
              )}
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
        </div>
      </main>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-4">
            <h3 className="font-semibold mb-4">Editează profilul</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Nume afișat
                </label>
                <Input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Numele tău"
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Acesta va fi afișat în loc de numele complet.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Bio
                </label>
                <Textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Spune ceva despre tine..."
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {editBio.length}/500
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditModal(false)}
              >
                Anulează
              </Button>
              <Button
                size="sm"
                onClick={handleEditProfile}
                disabled={isEditing}
                isLoading={isEditing}
              >
                Salvează
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
