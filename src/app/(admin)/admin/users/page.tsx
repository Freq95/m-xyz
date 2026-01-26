'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Avatar } from '@/components/ui';
import { Users, Ban, CheckCircle, Search } from 'lucide-react';

interface User {
  id: string;
  email: string;
  fullName: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  isBanned: boolean;
  bannedReason: string | null;
  createdAt: string;
  _count: {
    posts: number;
    comments: number;
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'banned' | 'active'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('filter', filter);
      if (searchQuery) params.append('q', searchQuery);

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const result = await response.json();
        setUsers(result.data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleBanToggle = async (userId: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? 'unban' : 'ban';
    const reason = currentlyBanned ? undefined : prompt('Motivul suspendării:');

    if (!currentlyBanned && !reason) return;

    setActionLoading(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });

      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Utilizatori</h1>

        {/* Filter */}
        <div className="flex gap-2">
          {(['all', 'active', 'banned'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Toți' : f === 'active' ? 'Activi' : 'Suspendați'}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Caută după nume sau email..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </form>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-secondary rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-secondary rounded w-1/4 mb-2" />
                  <div className="h-3 bg-secondary rounded w-1/3" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nu s-au găsit utilizatori</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id} className="p-4">
              <div className="flex items-center gap-4">
                <Avatar
                  src={user.avatarUrl}
                  fallback={user.displayName || user.fullName}
                  size="md"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {user.displayName || user.fullName}
                    </span>
                    {user.role !== 'user' && (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs uppercase">
                        {user.role}
                      </span>
                    )}
                    {user.isBanned && (
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-xs">
                        Suspendat
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{user._count.posts} postări</span>
                    <span>{user._count.comments} comentarii</span>
                    <span>Înregistrat {formatDate(user.createdAt)}</span>
                  </div>
                  {user.isBanned && user.bannedReason && (
                    <p className="text-xs text-red-500 mt-1">
                      Motiv: {user.bannedReason}
                    </p>
                  )}
                </div>

                <Button
                  size="sm"
                  variant={user.isBanned ? 'outline' : 'ghost'}
                  onClick={() => handleBanToggle(user.id, user.isBanned)}
                  isLoading={actionLoading === user.id}
                  disabled={!!actionLoading || user.role === 'admin'}
                  className={user.isBanned ? '' : 'text-destructive hover:bg-destructive hover:text-destructive-foreground'}
                >
                  {user.isBanned ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Reactivează
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4 mr-1" />
                      Suspendă
                    </>
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
