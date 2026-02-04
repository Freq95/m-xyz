'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui';

export function MessageBadge() {
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/messages/unread-count');
        if (response.ok) {
          const result = await response.json();
          setUnreadCount(result.data?.unreadCount ?? 0);
        }
      } catch (err) {
        console.error('Failed to fetch unread messages:', err);
      }
    };

    fetchUnreadCount();

    // Poll every 30 seconds for new messages
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
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
