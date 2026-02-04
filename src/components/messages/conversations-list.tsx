'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Button, Card, Avatar, Skeleton } from '@/components/ui';
import { useToast } from '@/components/shared';
import { getProfileUrl } from '@/lib/utils/profile';

interface Conversation {
  id: string;
  otherUser: {
    id: string;
    name: string;
    username?: string | null;
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

interface ConversationsListProps {
  activeConversationId?: string;
}

export function ConversationsList({ activeConversationId }: ConversationsListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchConversations(true);

    // Poll for conversation updates every 10 seconds
    const interval = setInterval(() => {
      pollConversations();
    }, 10000);

    return () => clearInterval(interval);
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

  const pollConversations = async () => {
    try {
      // Silently fetch latest conversations
      const params = new URLSearchParams({ limit: '20' });
      const response = await fetch(`/api/conversations?${params}`);
      const result = await response.json();

      if (response.ok && result.data) {
        // Update conversations if there are changes
        setConversations(result.data);
      }
    } catch (err) {
      // Silent fail for polling
      console.error('Polling conversations failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-bold">Mesaje</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <h2 className="text-xl font-bold">Mesaje</h2>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nu ai conversații încă
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((convo) => (
              <Link
                key={convo.id}
                href={`/messages/${convo.id}`}
                aria-current={activeConversationId === convo.id ? 'page' : undefined}
                className={`flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors ${
                  activeConversationId === convo.id ? 'bg-muted' : ''
                }`}
              >
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
              </Link>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="p-3">
            <Button
              onClick={() => fetchConversations(false)}
              variant="outline"
              className="w-full"
              disabled={isLoadingMore}
              isLoading={isLoadingMore}
            >
              Încarcă mai multe
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
