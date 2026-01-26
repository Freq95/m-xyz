'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { MessageCircle, MoreHorizontal, Eye, Bookmark, Share2, Flag, Link as LinkIcon } from 'lucide-react';
import { Button, Card, Avatar } from '@/components/ui';
import type { PostCategory } from '@/lib/validations/post';

interface PostCardProps {
  post: {
    id: string;
    title: string | null;
    body: string;
    category: PostCategory;
    priceCents: number | null;
    currency: string;
    isFree: boolean;
    isPinned: boolean;
    status?: string;
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
  };
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

export function PostCard({ post }: PostCardProps) {
  const category = categoryConfig[post.category];
  const isMarketplace = ['SELL', 'BUY', 'SERVICE'].includes(post.category);
  const isSold = post.status === 'sold';
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
    locale: ro,
  });

  return (
    <Card className={`p-4 ${post.isPinned ? 'border-primary/50 bg-primary/5' : ''} ${isSold ? 'opacity-75' : ''}`}>
      <div className="flex items-start gap-3">
        <Avatar fallback={post.author.name} src={post.author.avatarUrl} size="md" />
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{post.author.name}</span>
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
              {post.isPinned && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  Fixat
                </span>
              )}
            </div>
            <PostCardMenu postId={post.id} />
          </div>

          {/* Category Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${category.className}`}>
              {category.label}
            </span>
            {isSold && (
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground line-through-decoration">
                VÂNDUT
              </span>
            )}
          </div>

          {/* Title */}
          {post.title && (
            <Link href={`/post/${post.id}`}>
              <h3 className="font-medium text-sm mb-1 hover:text-primary transition-colors">
                {post.title}
              </h3>
            </Link>
          )}

          {/* Body */}
          <Link href={`/post/${post.id}`}>
            <p className="text-sm mb-3 line-clamp-3 hover:text-foreground/80 transition-colors">
              {post.body}
            </p>
          </Link>

          {/* Price (for marketplace posts) */}
          {isMarketplace && (
            <div className="mb-3">
              {post.isFree ? (
                <span className="text-sm font-semibold text-green-600">Gratuit</span>
              ) : post.priceCents ? (
                <span className="text-sm font-semibold">
                  {formatPrice(post.priceCents, post.currency)}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Preț negociabil</span>
              )}
            </div>
          )}

          {/* Images Preview */}
          {post.images.length > 0 && (
            <Link href={`/post/${post.id}`} className="block mb-3">
              <div className={`grid gap-1 rounded-lg overflow-hidden ${
                post.images.length === 1 ? 'grid-cols-1' :
                post.images.length === 2 ? 'grid-cols-2' :
                'grid-cols-2'
              }`}>
                {post.images.slice(0, 4).map((image, index) => (
                  <div
                    key={image.id}
                    className={`relative bg-muted h-32 ${
                      post.images.length === 3 && index === 0 ? 'row-span-2 h-auto' : ''
                    }`}
                  >
                    <Image
                      src={image.thumbnailUrl || image.url}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 50vw, 200px"
                      className="object-cover"
                      loading="lazy"
                    />
                    {index === 3 && post.images.length > 4 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <span className="text-white font-semibold">
                          +{post.images.length - 4}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Link>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/post/${post.id}`}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-xs">{post.commentCount}</span>
              </Link>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Eye className="w-4 h-4" />
                <span className="text-xs">{post.viewCount}</span>
              </div>
            </div>
            <SaveButton postId={post.id} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function PostCardMenu({ postId }: { postId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleShare = async () => {
    const postUrl = `${window.location.origin}/post/${postId}`;

    // Try Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Postare din Vecinu',
          url: postUrl,
        });
        setIsOpen(false);
        return;
      } catch (err) {
        // User cancelled or error - fall through to copy
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setIsOpen(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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

      if (response.ok || response.status === 401) {
        // Success or not logged in - close modal either way
        setShowReportModal(false);
        setReportReason('');
        setIsOpen(false);
      }
    } catch (err) {
      console.error('Failed to report:', err);
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 flex-shrink-0"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MoreHorizontal className="w-4 h-4" />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && !showReportModal && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-lg shadow-lg z-50 py-1">
          <button
            onClick={handleShare}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted transition-colors"
          >
            {copied ? (
              <>
                <LinkIcon className="w-4 h-4 text-green-600" />
                <span className="text-green-600">Link copiat!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Distribuie</span>
              </>
            )}
          </button>
          <button
            onClick={() => setShowReportModal(true)}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted transition-colors text-destructive"
          >
            <Flag className="w-4 h-4" />
            <span>Raportează</span>
          </button>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-4">
            <h3 className="font-semibold mb-3">Raportează postarea</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Spune-ne de ce consideri că această postare încalcă regulile comunității.
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Descrie motivul raportării..."
              className="w-full h-24 px-3 py-2 text-sm border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason('');
                  setIsOpen(false);
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
    </div>
  );
}

function SaveButton({ postId, initialSaved }: { postId: string; initialSaved?: boolean }) {
  const [isSaved, setIsSaved] = useState(initialSaved ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(initialSaved !== undefined);

  // Fetch initial saved state if not provided
  useEffect(() => {
    if (hasFetched) return;

    const checkSavedStatus = async () => {
      try {
        const response = await fetch(`/api/posts/${postId}/save`);
        if (response.ok) {
          const result = await response.json();
          setIsSaved(result.data?.saved ?? false);
        }
      } catch (err) {
        console.error('Failed to check saved status:', err);
      } finally {
        setHasFetched(true);
      }
    };

    checkSavedStatus();
  }, [postId, hasFetched]);

  const handleToggleSave = async () => {
    setIsLoading(true);
    try {
      const method = isSaved ? 'DELETE' : 'POST';
      const response = await fetch(`/api/posts/${postId}/save`, { method });

      if (response.ok) {
        setIsSaved(!isSaved);
      }
    } catch (err) {
      console.error('Failed to toggle save:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleSave}
      disabled={isLoading}
      className={`p-1 rounded transition-colors ${
        isSaved
          ? 'text-primary'
          : 'text-muted-foreground hover:text-primary'
      }`}
      title={isSaved ? 'Șterge din salvate' : 'Salvează'}
    >
      <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
    </button>
  );
}
