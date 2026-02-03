'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { Button, Avatar, Textarea, Skeleton } from '@/components/ui';
import { useToast } from '@/components/shared';

function NewMessageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipientId = searchParams.get('userId');
  const toast = useToast();

  const [recipient, setRecipient] = useState<{ id: string; name: string; avatarUrl: string | null } | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!recipientId) {
      router.push('/messages');
      return;
    }

    // Fetch recipient info
    fetch(`/api/users/${recipientId}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.data) {
          setRecipient({
            id: result.data.id,
            name: result.data.name,
            avatarUrl: result.data.avatarUrl,
          });
        } else {
          toast.error('Utilizatorul nu a fost găsit');
          router.push('/messages');
        }
        setIsLoading(false);
      })
      .catch(() => {
        toast.error('A apărut o eroare');
        router.push('/messages');
      });
  }, [recipientId, router, toast.error]);

  const handleSend = async () => {
    if (!messageBody.trim() || isSending || !recipient) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: recipient.id,
          body: messageBody.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Redirect to conversation
        router.push(`/messages/${result.data.conversationId}`);
      } else {
        toast.error(result.error || 'Nu s-a putut trimite mesajul');
      }
    } catch (err) {
      toast.error('A apărut o eroare');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background border-b border-border p-4">
          <Skeleton className="h-8 w-64" />
        </header>
        <main className="mx-auto max-w-3xl px-4 py-4">
          <Skeleton className="h-64" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
          <Link href="/messages">
            <Button variant="ghost" size="sm" aria-label="Înapoi">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          {recipient && (
            <>
              <Avatar src={recipient.avatarUrl} fallback={recipient.name} size="sm" />
              <h1 className="text-lg font-semibold">Mesaj nou către {recipient.name}</h1>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 py-4">
        <div className="space-y-4">
          <Textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Scrie mesajul tău aici..."
            rows={8}
            maxLength={2000}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{messageBody.length}/2000 caractere</p>
            <Button
              onClick={handleSend}
              disabled={!messageBody.trim() || isSending}
              isLoading={isSending}
            >
              <Send className="w-4 h-4 mr-2" />
              Trimite
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function NewMessagePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background border-b border-border p-4">
          <Skeleton className="h-8 w-64" />
        </header>
        <main className="mx-auto max-w-3xl px-4 py-4">
          <Skeleton className="h-64" />
        </main>
      </div>
    }>
      <NewMessageContent />
    </Suspense>
  );
}
