'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  ArrowLeft,
  MessageCircle,
  Eye,
  Send,
  Trash2,
  Edit,
  Share2,
  Flag,
  Link as LinkIcon,
  Check,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { Button, Card, Avatar, Textarea, Skeleton } from '@/components/ui';
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
  updatedAt: string;
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
    width: number | null;
    height: number | null;
  }>;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  replyCount: number;
  replies: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };
  }>;
}

interface User {
  id: string;
  fullName: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const categoryConfig: Record<PostCategory, { label: string; className: string }> = {
  ALERT: { label: 'Alertă', className: 'bg-destructive/10 text-destructive' },
  SELL: { label: 'Vând', className: 'bg-green-500/10 text-green-600' },
  BUY: { label: 'Cumpăr', className: 'bg-blue-500/10 text-blue-600' },
  SERVICE: { label: 'Serviciu', className: 'bg-purple-500/10 text-purple-600' },
  QUESTION: { label: 'Întrebare', className: 'bg-primary/10 text-primary' },
  EVENT: { label: 'Eveniment', className: 'bg-orange-500/10 text-orange-600' },
  LOST_FOUND: { label: 'Pierdut/Găsit', className: 'bg-yellow-500/10 text-yellow-600' },
};

function formatPrice(priceCents: number, currency: string): string {
  const price = priceCents / 100;
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const [isTogglingSold, setIsTogglingSold] = useState(false);

  // Fetch current user
  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const result = await response.json();
          setUser(result.data?.user || null);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      }
    }
    fetchUser();
  }, []);

  // Fetch post
  useEffect(() => {
    async function fetchPost() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/posts/${postId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Postarea nu a fost găsită');
        }

        setPost(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'A apărut o eroare');
      } finally {
        setIsLoading(false);
      }
    }

    if (postId) {
      fetchPost();
    }
  }, [postId]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!postId) return;

    setIsLoadingComments(true);

    try {
      const response = await fetch(`/api/comments?postId=${postId}`);
      const result = await response.json();

      if (response.ok) {
        setComments(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setIsLoadingComments(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Submit comment
  const handleSubmitComment = async (parentId?: string) => {
    const text = parentId ? replyText : newComment;
    if (!text.trim() || !user) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          parentId: parentId || undefined,
          body: text.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Nu s-a putut adăuga comentariul');
      }

      // Refresh comments
      await fetchComments();

      // Clear input
      if (parentId) {
        setReplyText('');
        setReplyingTo(null);
      } else {
        setNewComment('');
      }

      // Update post comment count
      if (post) {
        setPost({ ...post, commentCount: post.commentCount + 1 });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'A apărut o eroare');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Sigur vrei să ștergi acest comentariu?')) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Nu s-a putut șterge comentariul');
      }

      // Refresh comments
      await fetchComments();

      // Update post comment count
      if (post) {
        setPost({ ...post, commentCount: post.commentCount - 1 });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'A apărut o eroare');
    }
  };

  // Delete post
  const handleDeletePost = async () => {
    if (!confirm('Sigur vrei să ștergi această postare?')) return;

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Nu s-a putut șterge postarea');
      }

      router.push('/feed');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'A apărut o eroare');
    }
  };

  // Share post
  const handleShare = async () => {
    const postUrl = `${window.location.origin}/post/${postId}`;

    // Try Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title || 'Postare din Vecinu',
          url: postUrl,
        });
        return;
      } catch (err) {
        // User cancelled or error - fall through to copy
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Report post
  const handleReport = async () => {
    if (!reportReason.trim()) return;

    setIsReporting(true);
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'post',
          targetId: postId,
          reason: reportReason,
        }),
      });

      if (response.ok) {
        setShowReportModal(false);
        setReportReason('');
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (err) {
      console.error('Failed to report:', err);
    } finally {
      setIsReporting(false);
    }
  };

  // Edit post
  const handleEdit = async () => {
    if (!editBody.trim()) return;

    setIsEditing(true);
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim() || undefined,
          body: editBody.trim(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // Merge updated fields with existing post data
        setPost((prev) =>
          prev
            ? {
                ...prev,
                title: result.data.title,
                body: result.data.body,
                category: result.data.category,
                priceCents: result.data.priceCents,
                isFree: result.data.isFree,
                status: result.data.status,
                updatedAt: result.data.updatedAt,
              }
            : null
        );
        setShowEditModal(false);
      } else {
        const result = await response.json();
        alert(result.error || 'Nu s-a putut actualiza postarea');
      }
    } catch (err) {
      console.error('Failed to edit:', err);
      alert('A apărut o eroare');
    } finally {
      setIsEditing(false);
    }
  };

  // Open edit modal
  const openEditModal = () => {
    if (post) {
      setEditTitle(post.title || '');
      setEditBody(post.body);
      setShowEditModal(true);
    }
  };

  // Load all replies for a comment
  const handleLoadAllReplies = async (commentId: string) => {
    if (loadingReplies[commentId] || expandedReplies[commentId]) return;

    setLoadingReplies((prev) => ({ ...prev, [commentId]: true }));

    try {
      const response = await fetch(`/api/comments/${commentId}/replies`);
      const result = await response.json();

      if (response.ok) {
        // Update the comment's replies in state
        setComments((prevComments) =>
          prevComments.map((comment) =>
            comment.id === commentId
              ? { ...comment, replies: result.data || [] }
              : comment
          )
        );
        setExpandedReplies((prev) => ({ ...prev, [commentId]: true }));
      }
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      setLoadingReplies((prev) => ({ ...prev, [commentId]: false }));
    }
  };

  // Toggle sold status
  const handleToggleSold = async () => {
    if (!post) return;

    setIsTogglingSold(true);
    try {
      const response = await fetch(`/api/posts/${postId}/sold`, {
        method: 'PATCH',
      });

      if (response.ok) {
        const result = await response.json();
        setPost((prev) =>
          prev ? { ...prev, status: result.data.status } : null
        );
      } else {
        const result = await response.json();
        alert(result.error || 'Nu s-a putut actualiza statusul');
      }
    } catch (err) {
      console.error('Failed to toggle sold:', err);
      alert('A apărut o eroare');
    } finally {
      setIsTogglingSold(false);
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
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <span className="font-semibold">Postare</span>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-12 text-center">
          <p className="text-destructive mb-4">{error || 'Postarea nu a fost găsită'}</p>
          <Link href="/feed">
            <Button>Înapoi la feed</Button>
          </Link>
        </main>
      </div>
    );
  }

  const category = categoryConfig[post.category];
  const isMarketplace = ['SELL', 'BUY', 'SERVICE'].includes(post.category);
  const isSold = post.status === 'sold';
  const isAuthor = user?.id === post.author.id;
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
    locale: ro,
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/feed">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <span className="font-semibold">Postare</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleShare} title={copied ? 'Link copiat!' : 'Distribuie'}>
              {copied ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
            </Button>
            {isAuthor ? (
              <>
                <Button variant="ghost" size="sm" onClick={openEditModal}>
                  <Edit className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDeletePost}>
                  <Trash2 className="w-5 h-5 text-destructive" />
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowReportModal(true)}>
                <Flag className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-4">
        {/* Post */}
        <Card className={`p-4 mb-4 ${post.isPinned ? 'border-primary/50 bg-primary/5' : ''}`}>
          <div className="flex items-start gap-3">
            <Avatar fallback={post.author.name} src={post.author.avatarUrl} size="md" />
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-sm">{post.author.name}</span>
                <span className="text-xs text-muted-foreground">{timeAgo}</span>
                {post.isPinned && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    Fixat
                  </span>
                )}
              </div>

              {/* Category Badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${category.className}`}>
                  {category.label}
                </span>
                {isSold && (
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    VÂNDUT
                  </span>
                )}
              </div>

              {/* Location */}
              <p className="text-xs text-muted-foreground mb-2">
                în {post.neighborhood.name}
              </p>

              {/* Title */}
              {post.title && (
                <h1 className="font-semibold text-lg mb-2">{post.title}</h1>
              )}

              {/* Body */}
              <p className="text-sm whitespace-pre-wrap mb-4">{post.body}</p>

              {/* Price (for marketplace posts) */}
              {isMarketplace && (
                <div className="mb-4">
                  {post.isFree ? (
                    <span className={`text-lg font-semibold text-green-600 ${isSold ? 'line-through opacity-50' : ''}`}>Gratuit</span>
                  ) : post.priceCents ? (
                    <span className={`text-lg font-semibold ${isSold ? 'line-through opacity-50' : ''}`}>
                      {formatPrice(post.priceCents, post.currency)}
                    </span>
                  ) : (
                    <span className={`text-sm text-muted-foreground ${isSold ? 'line-through' : ''}`}>Preț negociabil</span>
                  )}
                </div>
              )}

              {/* Mark as sold button (author only, marketplace posts) */}
              {isMarketplace && isAuthor && (
                <div className="mb-4">
                  <Button
                    variant={isSold ? 'outline' : 'default'}
                    size="sm"
                    onClick={handleToggleSold}
                    disabled={isTogglingSold}
                    isLoading={isTogglingSold}
                  >
                    {isSold ? (
                      <>
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Marchează ca disponibil
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Marchează ca vândut
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Images */}
              {post.images.length > 0 && (
                <div className="mb-4 space-y-2">
                  {post.images.map((image) => (
                    <img
                      key={image.id}
                      src={image.url}
                      alt=""
                      className="w-full rounded-lg"
                    />
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-xs">{post.commentCount} comentarii</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  <span className="text-xs">{post.viewCount} vizualizări</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Comments Section */}
        <div className="mb-4">
          <h2 className="font-semibold mb-4">Comentarii ({post.commentCount})</h2>

          {/* New Comment Input */}
          {user ? (
            <Card className="p-3 mb-4">
              <div className="flex items-start gap-3">
                <Avatar
                  fallback={user.displayName || user.fullName}
                  src={user.avatarUrl}
                  size="sm"
                />
                <div className="flex-1">
                  <Textarea
                    placeholder="Scrie un comentariu..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="mb-2 resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSubmitComment()}
                      disabled={!newComment.trim() || isSubmitting}
                      isLoading={isSubmitting}
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Trimite
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-4 mb-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Trebuie să fii autentificat pentru a comenta.
              </p>
              <Link href="/login">
                <Button size="sm">Autentifică-te</Button>
              </Link>
            </Card>
          )}

          {/* Comments List */}
          {isLoadingComments ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <Card className="p-8 text-center">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nu sunt comentarii încă. Fii primul care comentează!
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <Card key={comment.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <Avatar
                      fallback={comment.author.name}
                      src={comment.author.avatarUrl}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{comment.author.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.createdAt), {
                              addSuffix: true,
                              locale: ro,
                            })}
                          </span>
                        </div>
                        {user?.id === comment.author.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm mt-1">{comment.body}</p>

                      {/* Reply button */}
                      {user && (
                        <button
                          onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                          className="text-xs text-muted-foreground hover:text-primary mt-2"
                        >
                          Răspunde
                        </button>
                      )}

                      {/* Reply input */}
                      {replyingTo === comment.id && user && (
                        <div className="mt-3 flex items-start gap-2">
                          <Avatar
                            fallback={user.displayName || user.fullName}
                            src={user.avatarUrl}
                            size="xs"
                          />
                          <div className="flex-1">
                            <Textarea
                              placeholder="Scrie un răspuns..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              rows={1}
                              className="mb-2 resize-none text-sm"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyText('');
                                }}
                              >
                                Anulează
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSubmitComment(comment.id)}
                                disabled={!replyText.trim() || isSubmitting}
                                isLoading={isSubmitting}
                              >
                                Răspunde
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Replies */}
                      {comment.replies.length > 0 && (
                        <div className="mt-3 ml-4 border-l-2 border-border pl-3 space-y-3">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex items-start gap-2">
                              <Avatar
                                fallback={reply.author.name}
                                src={reply.author.avatarUrl}
                                size="xs"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-xs">{reply.author.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(reply.createdAt), {
                                      addSuffix: true,
                                      locale: ro,
                                    })}
                                  </span>
                                </div>
                                <p className="text-sm mt-0.5">{reply.body}</p>
                              </div>
                            </div>
                          ))}
                          {comment.replyCount > comment.replies.length && !expandedReplies[comment.id] && (
                            <button
                              onClick={() => handleLoadAllReplies(comment.id)}
                              disabled={loadingReplies[comment.id]}
                              className="text-xs text-primary hover:underline disabled:opacity-50"
                            >
                              {loadingReplies[comment.id]
                                ? 'Se încarcă...'
                                : `Vezi toate ${comment.replyCount} răspunsuri`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-4">
            <h3 className="font-semibold mb-3">Raportează postarea</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Spune-ne de ce consideri că această postare încalcă regulile comunității.
            </p>
            <Textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Descrie motivul raportării..."
              rows={4}
              className="mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason('');
                }}
              >
                Anulează
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReport}
                disabled={!reportReason.trim() || isReporting}
                isLoading={isReporting}
              >
                Trimite raportul
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-lg p-4">
            <h3 className="font-semibold mb-3">Editează postarea</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Titlu (opțional)</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Titlul postării"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Conținut</label>
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Conținutul postării..."
                  rows={6}
                />
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
                onClick={handleEdit}
                disabled={!editBody.trim() || isEditing}
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
