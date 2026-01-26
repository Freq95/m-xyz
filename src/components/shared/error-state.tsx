import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button, Card } from '@/components/ui';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showHomeButton?: boolean;
}

/**
 * Reusable error state component
 * Used for displaying errors in specific sections/pages
 */
export function ErrorState({
  title = 'A apărut o eroare',
  message = 'Ceva nu a mers bine. Te rugăm să încerci din nou.',
  onRetry,
  showHomeButton = false,
}: ErrorStateProps) {
  return (
    <Card className="p-8 text-center">
      <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>

      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6">{message}</p>

      <div className="flex gap-3 justify-center">
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Încearcă din nou
          </Button>
        )}
        {showHomeButton && (
          <Button onClick={() => (window.location.href = '/feed')}>
            <Home className="w-4 h-4 mr-2" />
            Înapoi acasă
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * Small inline error message
 */
export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
