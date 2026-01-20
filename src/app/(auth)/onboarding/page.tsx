'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Skeleton } from '@/components/ui';
import { fetchWithTimeout } from '@/lib/fetch';

interface Neighborhood {
  id: string;
  name: string;
  city: string;
  slug: string;
  description: string;
  memberCount: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNeighborhoods = async () => {
      try {
        const res = await fetchWithTimeout('/api/neighborhoods', { timeout: 15000 });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Eroare la încărcarea cartierelor');
        }

        setNeighborhoods(data.data.neighborhoods || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'A apărut o eroare');
      } finally {
        setIsFetching(false);
      }
    };

    fetchNeighborhoods();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedId) {
      setError('Te rugăm să selectezi un cartier');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetchWithTimeout('/api/user/select-neighborhood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ neighborhoodId: selectedId }),
        timeout: 30000,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'A apărut o eroare');
      }

      router.push('/feed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A apărut o eroare. Te rugăm să încerci din nou.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Alege-ți cartierul</h1>
        <p className="text-muted-foreground text-sm">
          Selectează cartierul din Timișoara în care locuiești pentru a vedea conținutul relevant.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {neighborhoods.map((neighborhood) => (
            <label
              key={neighborhood.id}
              className="block cursor-pointer"
              htmlFor={`neighborhood-${neighborhood.id}`}
            >
              <Card
                className={`p-4 transition-all hover:border-primary/50 ${
                  selectedId === neighborhood.id
                    ? 'border-primary bg-primary/5'
                    : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id={`neighborhood-${neighborhood.id}`}
                    name="neighborhood"
                    value={neighborhood.id}
                    checked={selectedId === neighborhood.id}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="mt-1 h-4 w-4 text-primary focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold">{neighborhood.name}</h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {neighborhood.memberCount} {neighborhood.memberCount === 1 ? 'membru' : 'membri'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {neighborhood.description}
                    </p>
                  </div>
                </div>
              </Card>
            </label>
          ))}
        </div>

        {neighborhoods.length === 0 && !error && (
          <div className="p-4 rounded-lg bg-muted text-muted-foreground text-sm text-center">
            Nu sunt disponibile cartiere momentan
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
          disabled={!selectedId || neighborhoods.length === 0}
        >
          Continuă
        </Button>
      </form>
    </div>
  );
}
