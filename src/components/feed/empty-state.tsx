import Link from 'next/link';
import { FileText, Plus, MapPin } from 'lucide-react';
import { buttonVariants } from '@/components/ui';

interface EmptyStateProps {
  title?: string;
  description?: string;
  showCreateButton?: boolean;
}

export function EmptyState({
  title = 'Nu sunt postări încă',
  description = 'Fii primul care postează în cartierul tău!',
  showCreateButton = true,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <FileText className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm mb-6">{description}</p>
      {showCreateButton && (
        <Link href="/post/new" className={buttonVariants()}>
          <Plus className="w-4 h-4 mr-2" />
          Creează prima postare
        </Link>
      )}
    </div>
  );
}

export function NoNeighborhoodState() {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <MapPin className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium mb-1">Selectează un cartier</h3>
      <p className="text-muted-foreground text-sm mb-6">
        Pentru a vedea postările din zona ta, trebuie să selectezi un cartier.
      </p>
      <Link href="/onboarding" className={buttonVariants()}>
        Selectează cartierul
      </Link>
    </div>
  );
}
