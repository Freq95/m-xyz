'use client';

import { useState, useEffect } from 'react';
import { Ban, BanIcon } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui';
import { useToast } from './toast';

interface BlockButtonProps {
  userId: string;
  variant?: 'icon' | 'button';
  onBlockChange?: (blocked: boolean) => void;
}

export function BlockButton({
  userId,
  variant = 'button',
  onBlockChange,
}: BlockButtonProps) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { showToast } = useToast();

  // Fetch current block status on mount
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    async function fetchBlockStatus() {
      setIsFetching(true);

      // Timeout after 5 seconds to prevent infinite loading
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('Block status fetch timed out');
          setIsFetching(false);
        }
      }, 5000);

      try {
        const response = await fetch(`/api/users/${userId}/block`, {
          cache: 'no-store', // Force fresh data
        });

        if (!response.ok) {
          console.error('Block status fetch failed:', response.status);
          // Don't throw - allow button to render with default false state
          if (isMounted) {
            setIsBlocked(false);
          }
        } else if (isMounted) {
          const result = await response.json();
          setIsBlocked(result.data?.isBlocked || false);
        }
      } catch (error) {
        console.error('Failed to fetch block status:', error);
        // Default to unblocked state rather than hiding button
        if (isMounted) {
          setIsBlocked(false);
        }
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) {
          setIsFetching(false);
        }
      }
    }

    fetchBlockStatus();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [userId]);

  const handleToggleBlock = async () => {
    // Capture state BEFORE toggle to determine correct API method
    const previousBlocked = isBlocked;
    const method = isBlocked ? 'DELETE' : 'POST';

    // Optimistic update
    setIsBlocked(!isBlocked);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/users/${userId}/block`, {
        method,
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update block status');
      }

      const data = await response.json();

      // Update state based on server response
      setIsBlocked(data.data.blocked);

      // Notify parent component
      onBlockChange?.(data.data.blocked);

      // Show success toast
      const message = data.data.blocked
        ? 'Nu vei mai vedea postările acestui utilizator'
        : 'Vei vedea din nou postările acestui utilizator';
      showToast('success', message);
    } catch (error) {
      // Rollback on error
      setIsBlocked(previousBlocked);
      const errorMessage = error instanceof Error ? error.message : 'A apărut o eroare';
      showToast('error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading skeleton while fetching initial state
  if (isFetching) {
    if (variant === 'icon') {
      return <Skeleton className="w-10 h-10 rounded-md" />;
    }
    return <Skeleton className="h-10 w-full rounded-md" />;
  }

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggleBlock}
        disabled={isLoading}
        aria-label={isBlocked ? 'Deblochează utilizator' : 'Blochează utilizator'}
        className={isBlocked ? 'text-destructive hover:text-destructive' : ''}
      >
        {isBlocked ? <BanIcon className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
      </Button>
    );
  }

  return (
    <Button
      variant={isBlocked ? 'outline' : 'destructive'}
      onClick={handleToggleBlock}
      disabled={isLoading}
      className="w-full"
    >
      {isBlocked ? (
        <>
          <BanIcon className="w-4 h-4 mr-2" />
          Deblocați
        </>
      ) : (
        <>
          <Ban className="w-4 h-4 mr-2" />
          Blocați utilizatorul
        </>
      )}
    </Button>
  );
}
