'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Mail className="w-8 h-8 text-primary" />
      </div>

      <h1 className="text-2xl font-bold mb-2">Verifică-ți emailul</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Am trimis un link de verificare la{' '}
        {email ? (
          <span className="font-medium text-foreground">{email}</span>
        ) : (
          'adresa ta de email'
        )}
        . Click pe link pentru a-ți activa contul.
      </p>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Nu ai primit emailul? Verifică folderul Spam sau
        </p>
        <Button variant="outline" className="w-full">
          Retrimite emailul
        </Button>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Înapoi la autentificare
        </Link>
      </p>
    </div>
  );
}

function VerifyEmailSkeleton() {
  return (
    <div className="text-center">
      <Skeleton className="w-16 h-16 rounded-full mx-auto mb-6" />
      <Skeleton className="h-8 w-48 mx-auto mb-2" />
      <Skeleton className="h-4 w-64 mx-auto mb-6" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailSkeleton />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
