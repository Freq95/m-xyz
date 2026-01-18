import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
        outline: 'text-foreground border-border',
        // Category variants
        alert: 'border-red-500/20 bg-red-500/10 text-red-500',
        sell: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
        buy: 'border-purple-500/20 bg-purple-500/10 text-purple-500',
        service: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
        question: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-500',
        event: 'border-pink-500/20 bg-pink-500/10 text-pink-500',
        lostFound: 'border-orange-500/20 bg-orange-500/10 text-orange-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
