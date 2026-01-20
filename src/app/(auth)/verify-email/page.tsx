'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui';

function VerifyEmailContent() {
  const [email, setEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    // Get email from sessionStorage (set during registration)
    const storedEmail = sessionStorage.getItem('pendingVerificationEmail');
    if (storedEmail) {
      setEmail(storedEmail);
      // Keep it for potential resend - don't clear it
    }
  }, []);

  const handleResend = async () => {
    if (!email || isResending) return;

    setIsResending(true);
    setResendStatus('idle');
    setResendMessage(null);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (response.ok) {
        setResendStatus('success');
        setResendMessage('Email trimis! Verifică inbox-ul și folderul Spam.');
      } else {
        setResendStatus('error');
        setResendMessage(result.error || 'Nu am putut retrimite emailul.');
      }
    } catch {
      setResendStatus('error');
      setResendMessage('Eroare de conexiune. Încearcă din nou.');
    } finally {
      setIsResending(false);
    }
  };

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

      {/* Resend Status Messages */}
      {resendStatus === 'success' && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-green-500/10 text-green-600 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{resendMessage}</span>
        </div>
      )}

      {resendStatus === 'error' && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{resendMessage}</span>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Nu ai primit emailul? Verifică folderul Spam sau
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={!email || isResending}
          isLoading={isResending}
        >
          {isResending ? 'Se trimite...' : 'Retrimite emailul'}
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
