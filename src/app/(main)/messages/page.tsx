'use client';

import { ConversationsList, MessagesEmptyState } from '@/components/messages';

export default function MessagesPage() {
  return (
    <div className="fixed inset-0 flex flex-col md:flex-row bg-background pb-20">
      {/* Conversations List - Full screen on mobile, sidebar on desktop */}
      <div className="w-full md:w-[400px] md:border-r border-border h-full overflow-hidden">
        <ConversationsList />
      </div>

      {/* Empty State - Hidden on mobile, shown on desktop */}
      <div className="hidden md:flex flex-1 items-center justify-center">
        <MessagesEmptyState />
      </div>
    </div>
  );
}
