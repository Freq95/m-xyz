'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Plus, Bookmark, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getProfileUrl } from '@/lib/utils/profile';

interface User {
  id: string;
  username?: string | null;
}

export function BottomNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const result = await response.json();
          setUser(result.data?.user || null);
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      }
    }
    fetchUser();
  }, []);

  // Don't show bottom nav on these pages
  const hiddenRoutes = ['/post/new', '/onboarding', '/login', '/register', '/verify-email'];
  if (hiddenRoutes.some(route => pathname?.startsWith(route))) {
    return null;
  }

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex items-center justify-around py-2">
          {/* Home / Feed */}
          <Link
            href="/feed"
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              isActive('/feed')
                ? 'text-primary'
                : 'text-muted-foreground hover:text-primary'
            }`}
            aria-label="Acasă"
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">Acasă</span>
          </Link>

          {/* Marketplace (disabled - coming soon) */}
          <button
            className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground opacity-50 cursor-not-allowed"
            title="În curând"
            disabled
            aria-label="Piață (în curând)"
          >
            <div className="w-5 h-5 rounded-full border-2 border-current" />
            <span className="text-xs">Piață</span>
          </button>

          {/* Create Post */}
          <Link
            href="/post/new"
            className="flex items-center justify-center w-12 h-12 -mt-1 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
            aria-label="Creează postare nouă"
          >
            <Plus className="w-6 h-6" />
          </Link>

          {/* Saved Posts */}
          <Link
            href="/saved"
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              isActive('/saved')
                ? 'text-primary'
                : 'text-muted-foreground hover:text-primary'
            }`}
            aria-label="Postări salvate"
          >
            <Bookmark className="w-5 h-5" />
            <span className="text-xs">Salvate</span>
          </Link>

          {/* Profile */}
          <Link
            href={user ? getProfileUrl(user) : '/login'}
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              pathname?.startsWith('/profile')
                ? 'text-primary'
                : 'text-muted-foreground hover:text-primary'
            }`}
            aria-label="Profil"
          >
            <User className="w-5 h-5" />
            <span className="text-xs">Profil</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
