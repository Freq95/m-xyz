'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui';

export function MessageBadge() {
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        // Use conversations endpoint which now includes totalUnreadCount (batched call)
        const response = await fetch('/api/conversations?limit=1');
        if (response.ok) {
          const result = await response.json();
          setUnreadCount(result.meta?.totalUnreadCount ?? 0);
        }
      } catch (err) {
        console.error('Failed to fetch unread messages:', err);
      }
    };

    fetchUnreadCount();

    // Set initial polling interval (30 seconds when visible)
    intervalRef.current = setInterval(fetchUnreadCount, 30000);

    // Adjust polling based on tab visibility
    const handleVisibilityChange = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      if (document.hidden) {
        // Reduce polling to 2 minutes when tab is hidden
        intervalRef.current = setInterval(fetchUnreadCount, 120000);
      } else {
        // Resume normal 30-second polling when tab is visible
        intervalRef.current = setInterval(fetchUnreadCount, 30000);
        // Fetch immediately when tab becomes visible
        fetchUnreadCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <Link href="/messages">
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        aria-label={`Mesaje${unreadCount > 0 ? ` (${unreadCount} necitite)` : ''}`}
      >
        <MessageSquare className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-medium rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
    </Link>
  );
}
