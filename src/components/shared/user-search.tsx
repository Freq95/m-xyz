'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Avatar, Input } from '@/components/ui';

interface User {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  neighborhood: {
    name: string;
    city: string;
  } | null;
}

interface UserSearchProps {
  onSelectUser?: (user: User) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function UserSearch({
  onSelectUser,
  placeholder = 'Caută utilizatori...',
  autoFocus = false,
}: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search users with debounce
  useEffect(() => {
    if (!query || query.length < 2) {
      setUsers([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
          setShowResults(true);
        } else {
          setUsers([]);
        }
      } catch (error) {
        console.error('User search error:', error);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleClear = () => {
    setQuery('');
    setUsers([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  const handleSelect = (user: User) => {
    if (onSelectUser) {
      onSelectUser(user);
      setQuery('');
      setUsers([]);
      setShowResults(false);
    }
  };

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Șterge căutarea"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {showResults && (
        <div
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
        >
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Se caută...
            </div>
          ) : users.length > 0 ? (
            <div className="divide-y divide-border">
              {users.map((user) => {
                const displayName = user.displayName || user.username || 'Utilizator';
                const username = user.username ? `@${user.username}` : undefined;
                const location = user.neighborhood
                  ? `${user.neighborhood.name}, ${user.neighborhood.city}`
                  : undefined;

                return (
                  <div
                    key={user.id}
                    onClick={() => handleSelect(user)}
                    className="p-3 hover:bg-muted/50 cursor-pointer flex items-center gap-3 transition-colors"
                  >
                    <Avatar
                      src={user.avatarUrl || undefined}
                      alt={displayName}
                      size="md"
                      fallback={displayName[0]}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{displayName}</p>
                      {username && (
                        <p className="text-xs text-muted-foreground truncate">
                          {username}
                        </p>
                      )}
                      {location && (
                        <p className="text-xs text-muted-foreground truncate">
                          {location}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Niciun utilizator găsit
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UserSearch;
