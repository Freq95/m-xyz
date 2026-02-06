'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { Button, Avatar, Textarea, Skeleton } from '@/components/ui';
import { useToast } from '@/components/shared';
import { ConversationsList } from '@/components/messages';
import { getProfileUrl } from '@/lib/utils/profile';

interface Message {
  id: string;
  body: string;
  createdAt: string;
  isFromMe: boolean;
  isRead: boolean;
  sender: {
    id: string;
    name: string;
    username?: string | null;
    avatarUrl: string | null;
  };
}

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const toast = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [otherUser, setOtherUser] = useState<{ id: string; name: string; username?: string | null; avatarUrl: string | null } | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Memoized character counter display
  const characterCounter = useMemo(() => {
    const length = messageBody.length;
    if (length <= 400) return null;

    const isNearLimit = length >= 480;
    return {
      text: `${length}/500`,
      className: isNearLimit ? 'text-red-500 font-semibold' : 'text-muted-foreground',
    };
  }, [messageBody.length]);

  useEffect(() => {
    fetchMessages(true);

    // Start polling for new messages every 5 seconds (when visible)
    pollingIntervalRef.current = setInterval(() => {
      pollNewMessages();
    }, 5000);

    // Adjust polling based on tab visibility
    const handleVisibilityChange = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      if (document.hidden) {
        // Reduce polling to 2 minutes when tab is hidden
        pollingIntervalRef.current = setInterval(() => {
          pollNewMessages();
        }, 120000);
      } else {
        // Resume normal 5-second polling when tab is visible
        pollingIntervalRef.current = setInterval(() => {
          pollNewMessages();
        }, 5000);
        // Poll immediately when tab becomes visible
        pollNewMessages();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [conversationId]);

  useEffect(() => {
    // Only auto-scroll if we should (initial load, user sent message, or user is at bottom)
    if (shouldAutoScrollRef.current) {
      scrollToBottom();
      setHasNewMessages(false);
    }
  }, [messages]);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [messageBody]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isUserAtBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const threshold = 150; // pixels from bottom
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    return isAtBottom;
  };

  const handleScroll = () => {
    // Update auto-scroll preference based on scroll position
    shouldAutoScrollRef.current = isUserAtBottom();
  };

  const fetchMessages = async (reset = true) => {
    if (!reset && !hasMore) return;

    try {
      setIsLoadingMore(!reset);
      const params = new URLSearchParams({ limit: '30' });
      if (!reset && cursor) params.append('cursor', cursor);

      const response = await fetch(`/api/conversations/${conversationId}?${params}`);
      const result = await response.json();

      if (response.ok) {
        const newMessages = result.data || [];
        // Messages come in DESC order (newest first), reverse for display
        setMessages(reset ? newMessages.reverse() : [...newMessages.reverse(), ...messages]);
        setCursor(result.meta?.cursor);
        setHasMore(result.meta?.hasMore || false);

        // Extract other user from first message
        if (newMessages.length > 0 && !otherUser) {
          const firstMsg = newMessages[0];
          if (!firstMsg.isFromMe) {
            setOtherUser(firstMsg.sender);
          } else {
            // If all messages are from me, get from last message
            const otherMsg = newMessages.find((m: Message) => !m.isFromMe);
            if (otherMsg) {
              setOtherUser(otherMsg.sender);
            }
          }
        }
      } else {
        toast.error(result.error || 'Conversația nu a fost găsită');
        router.push('/messages');
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to fetch messages:', err);
      }
      toast.error('A apărut o eroare');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const pollNewMessages = async () => {
    try {
      // Check if user is at bottom before fetching
      const wasAtBottom = isUserAtBottom();

      // Fetch latest messages without showing loading state
      const params = new URLSearchParams({ limit: '30' });
      const response = await fetch(`/api/conversations/${conversationId}?${params}`);
      const result = await response.json();

      if (response.ok && result.data) {
        const latestMessages = result.data.reverse();

        if (latestMessages.length > 0) {
          // Use functional update to access current state and avoid stale closure
          setMessages((prevMessages) => {
            // Check if there are actually new messages
            if (prevMessages.length === 0) {
              return latestMessages;
            }

            const lastExistingId = prevMessages[prevMessages.length - 1]?.id;
            const lastFetchedId = latestMessages[latestMessages.length - 1]?.id;

            // If last message is the same, no new messages
            if (lastExistingId === lastFetchedId) {
              return prevMessages;
            }

            // Filter out messages we already have
            const newMessagesOnly = latestMessages.filter(
              (msg: Message) => !prevMessages.some((m) => m.id === msg.id)
            );

            if (newMessagesOnly.length > 0) {
              // Only enable auto-scroll if user was at bottom when new messages arrived
              shouldAutoScrollRef.current = wasAtBottom;
              // Show "new messages" indicator if user is not at bottom
              if (!wasAtBottom) {
                setHasNewMessages(true);
              }
              return [...prevMessages, ...newMessagesOnly];
            }

            return prevMessages;
          });
        }
      }
    } catch (err) {
      // Silent fail for polling - don't show error toast
      if (process.env.NODE_ENV !== 'production') {
        console.error('Polling failed:', err);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!messageBody.trim() || isSending || !otherUser) return;

    setIsSending(true);
    const tempBody = messageBody.trim();
    setMessageBody(''); // Clear input optimistically

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: otherUser.id,
          body: tempBody,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Enable auto-scroll when user sends their own message
        shouldAutoScrollRef.current = true;

        // Add message to local state
        setMessages((prev) => [...prev, {
          id: result.data.id,
          body: result.data.body,
          createdAt: result.data.createdAt,
          isFromMe: true,
          isRead: false,
          sender: result.data.sender,
        }]);
      } else {
        toast.error(result.error || 'Nu s-a putut trimite mesajul');
        setMessageBody(tempBody); // Restore message on error
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to send message:', err);
      }
      toast.error('A apărut o eroare');
      setMessageBody(tempBody); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSending) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleScrollToBottom = () => {
    shouldAutoScrollRef.current = true;
    setHasNewMessages(false);
    scrollToBottom();
  };

  return (
    <div className="fixed inset-0 flex bg-background pb-20">
      {/* Conversations List - Hidden on mobile, sidebar on desktop */}
      <div className="hidden md:block w-[400px] border-r border-border h-full overflow-hidden">
        <ConversationsList activeConversationId={conversationId} />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full">
        {isLoading ? (
          <>
            <header className="p-4 border-b border-border">
              <Skeleton className="h-8 w-48" />
            </header>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <header className="flex-shrink-0 p-4 border-b border-border bg-background flex items-center gap-3">
              {/* Back button - only on mobile */}
              <Link href="/messages" className="md:hidden">
                <Button variant="ghost" size="sm" aria-label="Înapoi">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              {otherUser && (
                <>
                  <Avatar src={otherUser.avatarUrl} fallback={otherUser.name} size="sm" />
                  <Link href={getProfileUrl(otherUser)} className="font-medium hover:underline">
                    {otherUser.name}
                  </Link>
                </>
              )}
            </header>

            {/* Messages - Scrollable */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-4 relative"
            >
              {hasMore && (
                <Button
                  onClick={() => fetchMessages(false)}
                  variant="outline"
                  className="w-full"
                  disabled={isLoadingMore}
                  isLoading={isLoadingMore}
                >
                  Încarcă mesaje mai vechi
                </Button>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.isFromMe ? 'flex-row-reverse' : ''} min-w-0`}>
                  <Avatar src={msg.sender.avatarUrl} fallback={msg.sender.name} size="sm" className="flex-shrink-0" />
                  <div className={`flex flex-col ${msg.isFromMe ? 'items-end' : 'items-start'} max-w-[70%] min-w-0`}>
                    <div className={`p-3 rounded-lg ${msg.isFromMe ? 'bg-primary text-primary-foreground' : 'bg-muted'} break-words`}>
                      <p className="text-sm whitespace-pre-wrap break-words overflow-anywhere">{msg.body}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 break-words">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: ro })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />

              {/* New Messages Indicator */}
              {hasNewMessages && !isUserAtBottom() && (
                <button
                  onClick={handleScrollToBottom}
                  className="fixed bottom-32 left-1/2 transform -translate-x-1/2 md:left-auto md:right-8 md:transform-none bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2 text-sm font-medium z-10"
                  aria-label="Scroll to new messages"
                >
                  <span>↓</span>
                  <span>Mesaje noi</span>
                </button>
              )}
            </div>

            {/* Input - Fixed Bottom */}
            <div className="flex-shrink-0 p-4 border-t border-border bg-background">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder="Scrie un mesaj..."
                    className="flex-1 resize-none min-h-[40px] max-h-[120px] w-full pr-14 py-2"
                    rows={1}
                    maxLength={500}
                    onKeyDown={handleKeyDown}
                  />
                  {characterCounter && (
                    <span
                      className={`absolute right-2 bottom-2 text-xs pointer-events-none ${characterCounter.className}`}
                    >
                      {characterCounter.text}
                    </span>
                  )}
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageBody.trim() || isSending}
                  isLoading={isSending}
                  aria-label="Trimite"
                  size="sm"
                  className="h-10 flex-shrink-0"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
