'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PostForm } from '@/components/feed/post-form';
import { Card } from '@/components/ui';

export default function NewPostPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Link
            href="/feed"
            className="p-2 -ml-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-semibold">Postare nouă</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Card className="p-6">
          <PostForm />
        </Card>
      </main>
    </div>
  );
}
