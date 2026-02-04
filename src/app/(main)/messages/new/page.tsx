'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui';
import { useToast } from '@/components/shared';

function NewMessageRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const toast = useToast();

  useEffect(() => {
    if (!userId) {
      router.push('/messages');
      return;
    }

    // Find or create conversation and redirect
    fetch(`/api/conversations/find-or-create?userId=${userId}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.data?.conversationId) {
          router.push(`/messages/${result.data.conversationId}`);
        } else {
          toast.error('Utilizatorul nu a fost găsit');
          router.push('/messages');
        }
      })
      .catch(() => {
        toast.error('A apărut o eroare');
        router.push('/messages');
      });
  }, [userId, router, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Skeleton className="h-8 w-48 mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Se încarcă conversația...</p>
      </div>
    </div>
  );
}

export default function NewMessagePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    }>
      <NewMessageRedirect />
    </Suspense>
  );
}
