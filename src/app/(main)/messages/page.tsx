'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Avatar, Skeleton } from '@/components/ui';
import { EmptyState } from '@/components/feed';
import { useToast } from '@/components/shared';

interface Conversation {
  id: string;
  otherUser: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  lastMessage: {
    body: string;
    createdAt: string;
    isFromMe: boolean;
  } | null;
  unreadCount: number;
  lastMessageAt: string;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchConversations(true);
  }, []);

  const fetchConversations = async (reset = true) => {
    if (!reset && !hasMore) return;

    try {
      setIsLoadingMore(!reset);
      const params = new URLSearchParams({ limit: '20' });
      if (!reset && cursor) params.append('cursor', cursor);

      const response = await fetch(`/api/conversations?${params}`);
      const result = await response.json();

      if (response.ok) {
        setConversations(reset ? result.data : (prev) => [...prev, ...result.data]);
        setCursor(result.meta?.cursor);
        setHasMore(result.meta?.hasMore || false);
      } else {
        toast.error(result.error || 'Nu s-au putut încărca conversațiile');
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      toast.error('A apărut o eroare');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background border-b border-border">
          <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-4">
            <Link href="/feed">
              <Button variant="ghost" size="sm" aria-label="Înapoi">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Mesaje</h1>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-4 space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-4">
          <Link href="/feed">
            <Button variant="ghost" size="sm" aria-label="Înapoi">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Mesaje</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-4">
        {conversations.length === 0 ? (
          <EmptyState
            title="Nicio conversație"
            description="Începe o conversație trimițând un mesaj"
            showCreateButton={false}
          />
        ) : (
          <div className="space-y-2">
            {conversations.map((convo) => (
              <Link key={convo.id} href={`/messages/${convo.id}`}>
                <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={convo.otherUser.avatarUrl}
                      fallback={convo.otherUser.name}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className={`font-medium truncate ${convo.unreadCount > 0 ? 'font-semibold' : ''}`}>
                          {convo.otherUser.name}
                        </h3>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {formatDistanceToNow(new Date(convo.lastMessageAt), {
                            addSuffix: true,
                            locale: ro,
                          })}
                        </span>
                      </div>
                      {convo.lastMessage && (
                        <p className={`text-sm truncate ${convo.unreadCount > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                          {convo.lastMessage.isFromMe && 'Tu: '}
                          {convo.lastMessage.body}
                        </p>
                      )}
                    </div>
                    {convo.unreadCount > 0 && (
                      <span className="w-6 h-6 bg-primary text-primary-foreground text-xs font-medium rounded-full flex items-center justify-center flex-shrink-0">
                        {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}

            {/* Load More */}
            {hasMore && (
              <Button
                onClick={() => fetchConversations(false)}
                variant="outline"
                className="w-full"
                disabled={isLoadingMore}
                isLoading={isLoadingMore}
              >
                Încarcă mai multe
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
