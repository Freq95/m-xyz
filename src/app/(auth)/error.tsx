'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Auth page error:', error);
  }, [error]);

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Ceva nu a mers bine</h1>
      <p className="text-muted-foreground text-sm mb-6">
        A apărut o eroare. Te rugăm să încerci din nou.
      </p>
      <div className="space-y-3">
        <Button onClick={reset} className="w-full">
          Încearcă din nou
        </Button>
        <Link href="/" className="block">
          <Button variant="outline" className="w-full">
            Înapoi la pagina principală
          </Button>
        </Link>
      </div>
    </div>
  );
}
