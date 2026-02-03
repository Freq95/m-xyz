'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { Button, Avatar, Textarea, Skeleton } from '@/components/ui';
import { useToast } from '@/components/shared';

interface Message {
  id: string;
  body: string;
  createdAt: string;
  isFromMe: boolean;
  isRead: boolean;
  sender: {
    id: string;
    name: string;
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
  const [otherUser, setOtherUser] = useState<{ id: string; name: string; avatarUrl: string | null } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages(true);
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      console.error('Failed to fetch messages:', err);
      toast.error('A apărut o eroare');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageBody.trim() || isSending || !otherUser) return;

    setIsSending(true);
    const tempBody = messageBody.trim();
    setMessageBody(''); // Clear input optimistically

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
      console.error('Failed to send message:', err);
      toast.error('A apărut o eroare');
      setMessageBody(tempBody); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="p-4 border-b border-border">
          <Skeleton className="h-8 w-48" />
        </header>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 p-4 border-b border-border bg-background flex items-center gap-3">
        <Link href="/messages">
          <Button variant="ghost" size="sm" aria-label="Înapoi">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        {otherUser && (
          <>
            <Avatar src={otherUser.avatarUrl} fallback={otherUser.name} size="sm" />
            <Link href={`/profile/${otherUser.id}`} className="font-medium hover:underline">
              {otherUser.name}
            </Link>
          </>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
          <div key={msg.id} className={`flex gap-3 ${msg.isFromMe ? 'flex-row-reverse' : ''}`}>
            <Avatar src={msg.sender.avatarUrl} fallback={msg.sender.name} size="sm" />
            <div className={`flex flex-col ${msg.isFromMe ? 'items-end' : 'items-start'} max-w-[70%]`}>
              <div className={`p-3 rounded-lg ${msg.isFromMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: ro })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-background">
        <div className="flex gap-2">
          <Textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Scrie un mesaj..."
            className="flex-1 resize-none"
            rows={2}
            maxLength={2000}
            onKeyDown={handleKeyDown}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageBody.trim() || isSending}
            isLoading={isSending}
            aria-label="Trimite"
            size="sm"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {messageBody.length}/2000 caractere
        </p>
      </div>
    </div>
  );
}
