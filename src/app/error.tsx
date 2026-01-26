'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button, Card } from '@/components/ui';

/**
 * Global error handler for Next.js pages
 * Catches errors that occur during rendering
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Page error:', error);
    }

    // TODO: Log to error tracking service (Sentry, etc.)
    // logErrorToService(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold mb-2">Ceva nu a mers bine</h1>
        <p className="text-muted-foreground mb-6">
          Ne pare rău, dar a apărut o eroare neașteptată. Încearcă să reîncarci pagina.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Detalii tehnice
            </summary>
            <pre className="mt-2 p-3 bg-secondary rounded text-xs overflow-auto">
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Încearcă din nou
          </Button>
          <Button onClick={() => (window.location.href = '/feed')}>
            <Home className="w-4 h-4 mr-2" />
            Înapoi acasă
          </Button>
        </div>
      </Card>
    </div>
  );
}
