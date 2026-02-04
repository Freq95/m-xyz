import { MessageSquare } from 'lucide-react';

export function MessagesEmptyState() {
  return (
    <div className="h-full flex items-center justify-center bg-muted/30">
      <div className="text-center p-8">
        <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-lg font-medium mb-2">Mesajele tale</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Selectează o conversație din listă pentru a vedea mesajele
        </p>
      </div>
    </div>
  );
}
