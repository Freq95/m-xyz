'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useToast } from '@/components/shared';

interface LikeButtonProps {
  postId: string;
  initialLiked?: boolean;
  initialCount?: number;
  onLikeChange?: (liked: boolean, newCount: number) => void;
}

export function LikeButton({ postId, initialLiked = false, initialCount = 0, onLikeChange }: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleToggleLike = async () => {
    if (isLoading) return;

    // Optimistic update
    const previousLiked = isLiked;
    const previousCount = likeCount;
    const newLiked = !isLiked;
    const newCount = newLiked ? likeCount + 1 : Math.max(0, likeCount - 1);

    setIsLiked(newLiked);
    setLikeCount(newCount);
    onLikeChange?.(newLiked, newCount);

    setIsLoading(true);

    try {
      const endpoint = `/api/posts/${postId}/like`;
      const method = newLiked ? 'POST' : 'DELETE';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle authentication error specifically
        if (response.status === 401) {
          throw new Error('Trebuie să fii autentificat pentru a aprecia');
        }
        throw new Error(result.error || result.message || 'Eroare la apreciere');
      }

      // Correct stale state if needed
      // When wasNew=false, like already existed - optimistic +1 is correct, keep it
      // When wasDeleted=false, like didn't exist - optimistic -1 is wrong, revert it
      if (!newLiked && !result.data?.wasDeleted) {
        setLikeCount(previousCount); // Revert - like didn't exist
      }
    } catch (error) {
      // Revert optimistic update on error
      setIsLiked(previousLiked);
      setLikeCount(previousCount);
      onLikeChange?.(previousLiked, previousCount);

      toast.error(
        error instanceof Error ? error.message : 'Eroare la apreciere'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleLike}
      disabled={isLoading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={isLiked ? 'Elimină aprecierea' : 'Apreciază'}
    >
      <Heart
        className={`w-4 h-4 transition-colors ${
          isLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
        }`}
      />
      {likeCount > 0 && (
        <span className={isLiked ? 'text-red-500' : 'text-muted-foreground'}>
          {likeCount}
        </span>
      )}
    </button>
  );
}
