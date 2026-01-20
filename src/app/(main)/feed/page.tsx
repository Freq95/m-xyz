'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Home, Bell, ShoppingBag, User, Plus, MessageCircle, Heart, MoreHorizontal } from 'lucide-react';
import { Button, Card, Avatar } from '@/components/ui';

// Temporary mock data - will be replaced with real data from API
const mockPosts = [
  {
    id: '1',
    author: {
      name: 'Maria Popescu',
      avatar: null,
      initials: 'MP',
    },
    content: 'Salut vecini! Știe cineva un electrician de încredere în zonă? Am o problemă cu tabloul electric.',
    createdAt: 'Acum 2 ore',
    likes: 5,
    comments: 8,
    category: 'intrebare',
  },
  {
    id: '2',
    author: {
      name: 'Ion Ionescu',
      avatar: null,
      initials: 'II',
    },
    content: 'ATENȚIE! Apa caldă va fi oprită mâine între orele 10:00-14:00 pentru lucrări de mentenanță. Anunț de la asociație.',
    createdAt: 'Acum 4 ore',
    likes: 23,
    comments: 4,
    category: 'alerta',
  },
  {
    id: '3',
    author: {
      name: 'Ana Maria',
      avatar: null,
      initials: 'AM',
    },
    content: 'Vând bicicletă pentru copii, stare foarte bună, folosită doar un sezon. Preț: 150 RON. Detalii în privat.',
    createdAt: 'Ieri',
    likes: 12,
    comments: 6,
    category: 'vanzare',
  },
];

export default function FeedPage() {
  const [posts] = useState(mockPosts);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">V</span>
            </div>
            <span className="font-semibold">Vecinu</span>
          </div>
          <Button variant="ghost" size="sm">
            <Bell className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-4 pb-24">
        {/* Create Post Button */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-3">
            <Avatar fallback="EU" size="md" />
            <Link
              href="/post/new"
              className="flex-1 text-left px-4 py-2 bg-secondary rounded-full text-muted-foreground text-sm hover:bg-secondary/80 transition-colors"
            >
              Ce se întâmplă în cartier?
            </Link>
          </div>
        </Card>

        {/* Posts Feed */}
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar fallback={post.author.name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{post.author.name}</span>
                      <span className="text-xs text-muted-foreground">{post.createdAt}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                  {post.category && (
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full mb-2 ${
                      post.category === 'alerta'
                        ? 'bg-destructive/10 text-destructive'
                        : post.category === 'vanzare'
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {post.category === 'alerta' ? 'Alertă' :
                       post.category === 'vanzare' ? 'Vânzare' :
                       post.category === 'intrebare' ? 'Întrebare' : post.category}
                    </span>
                  )}
                  <p className="text-sm mb-3">{post.content}</p>
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                      <Heart className="w-4 h-4" />
                      <span className="text-xs">{post.likes}</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-xs">{post.comments}</span>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {posts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              Nu sunt postări încă în cartierul tău.
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Creează prima postare
            </Button>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <div className="mx-auto max-w-2xl px-4">
          <div className="flex items-center justify-around py-2">
            <Link href="/feed" className="flex flex-col items-center gap-1 px-4 py-2 text-primary">
              <Home className="w-5 h-5" />
              <span className="text-xs">Acasă</span>
            </Link>
            <button
              className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground opacity-50 cursor-not-allowed"
              title="În curând"
              disabled
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="text-xs">Piață</span>
            </button>
            <Link
              href="/post/new"
              className="flex items-center justify-center w-12 h-12 -mt-4 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-6 h-6" />
            </Link>
            <button
              className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground opacity-50 cursor-not-allowed"
              title="În curând"
              disabled
            >
              <Bell className="w-5 h-5" />
              <span className="text-xs">Alerte</span>
            </button>
            <button
              className="flex flex-col items-center gap-1 px-4 py-2 text-muted-foreground opacity-50 cursor-not-allowed"
              title="În curând"
              disabled
            >
              <User className="w-5 h-5" />
              <span className="text-xs">Profil</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
