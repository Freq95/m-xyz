'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { ArrowLeft, Bell, MessageCircle, Reply, Check, CheckCheck } from 'lucide-react';
import { Button, Card } from '@/components/ui';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: { postId?: string } | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          router.push('/login');
        }
      } catch {
        setIsAuthenticated(false);
        router.push('/login');
      }
    }
    checkAuth();
  }, [router]);

  const fetchNotifications = useCallback(async (reset = true, currentCursor?: string) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({ limit: '20' });
      if (!reset && currentCursor) {
        params.append('cursor', currentCursor);
      }

      const response = await fetch(`/api/notifications?${params}`);
      if (response.ok) {
        const result = await response.json();

        if (reset) {
          setNotifications(result.data || []);
        } else {
          setNotifications((prev) => [...prev, ...(result.data || [])]);
        }

        setCursor(result.meta?.cursor);
        setHasMore(result.meta?.hasMore || false);
        setUnreadCount(result.meta?.unreadCount ?? 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications(true);
    }
  }, [isAuthenticated, fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && cursor) {
      fetchNotifications(false, cursor);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'NEW_COMMENT':
        return <MessageCircle className="w-5 h-5" />;
      case 'COMMENT_REPLY':
        return <Reply className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getPostUrl = (notification: Notification) => {
    const postId = notification.data?.postId;
    return postId ? `/post/${postId}` : '#';
  };

  if (isAuthenticated === null || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold">Notificări</h1>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-4">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold">Notificări</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                {unreadCount} necitite
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-1" />
              <span className="text-sm">Marchează toate</span>
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-4">
        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-medium mb-2">Nu ai notificări</h2>
            <p className="text-sm text-muted-foreground">
              Vei primi notificări când cineva comentează la postările tale sau răspunde la comentariile tale.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={getPostUrl(notification)}
                  onClick={() => {
                    if (!notification.isRead) {
                      handleMarkAsRead(notification.id);
                    }
                  }}
                >
                  <Card
                    className={`p-4 transition-colors hover:bg-muted/50 ${
                      !notification.isRead ? 'bg-primary/5 border-primary/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          !notification.isRead
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${
                            !notification.isRead ? 'font-medium' : ''
                          }`}
                        >
                          {notification.title}
                        </p>
                        {notification.body && (
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {notification.body}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: ro,
                          })}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          className="p-2 hover:bg-muted rounded-full"
                          title="Marchează ca citit"
                        >
                          <Check className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </Card>
                </Link>
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
                  {isLoadingMore ? 'Se încarcă...' : 'Mai multe notificări'}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
