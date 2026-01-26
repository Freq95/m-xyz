import Link from 'next/link';
import { FileQuestion, Home, Search } from 'lucide-react';
import { Button, Card } from '@/components/ui';

/**
 * Global 404 Not Found page
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-8 h-8 text-muted-foreground" />
        </div>

        <h1 className="text-4xl font-bold mb-2">404</h1>
        <h2 className="text-xl font-semibold mb-2">Pagina nu a fost găsită</h2>
        <p className="text-muted-foreground mb-6">
          Ne pare rău, dar pagina pe care o cauți nu există sau a fost mutată.
        </p>

        <div className="flex gap-3 justify-center">
          <Link href="/feed">
            <Button>
              <Home className="w-4 h-4 mr-2" />
              Înapoi acasă
            </Button>
          </Link>
          <Link href="/search">
            <Button variant="outline">
              <Search className="w-4 h-4 mr-2" />
              Caută
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
