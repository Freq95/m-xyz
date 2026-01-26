'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { Flag, Users, FileText, AlertTriangle } from 'lucide-react';

interface Stats {
  pendingReports: number;
  totalReports: number;
  bannedUsers: number;
  hiddenPosts: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
          const result = await response.json();
          setStats(result.data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = [
    {
      label: 'Rapoarte în așteptare',
      value: stats?.pendingReports ?? 0,
      icon: Flag,
      href: '/admin/reports',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: 'Total rapoarte',
      value: stats?.totalReports ?? 0,
      icon: AlertTriangle,
      href: '/admin/reports?status=all',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Utilizatori suspendați',
      value: stats?.bannedUsers ?? 0,
      icon: Users,
      href: '/admin/users?filter=banned',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      label: 'Postări ascunse',
      value: stats?.hiddenPosts ?? 0,
      icon: FileText,
      href: '/admin/posts?filter=hidden',
      color: 'text-gray-500',
      bgColor: 'bg-gray-500/10',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-secondary rounded w-24 mb-2" />
              <div className="h-8 bg-secondary rounded w-16" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.label} href={stat.href}>
                <Card className="p-6 hover:border-primary/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Acțiuni rapide</h2>
        <div className="flex gap-3">
          <Link
            href="/admin/reports"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            Vezi rapoartele
          </Link>
          <Link
            href="/feed"
            className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors"
          >
            Înapoi la feed
          </Link>
        </div>
      </div>
    </div>
  );
}
