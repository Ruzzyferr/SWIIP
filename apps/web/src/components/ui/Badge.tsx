import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'role' | 'notification' | 'status';

interface BadgeProps {
  variant?: BadgeVariant;
  color?: string;
  count?: number;
  children?: ReactNode;
  className?: string;
  maxCount?: number;
}

export function Badge({
  variant = 'default',
  color,
  count,
  children,
  className,
  maxCount = 99,
}: BadgeProps) {
  if (variant === 'notification' && count !== undefined) {
    const display = count > maxCount ? `${maxCount}+` : String(count);
    if (count === 0) return null;
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full font-bold text-white leading-none',
          'min-w-[16px] h-4 px-1',
          className
        )}
        style={{
          fontSize: '10px',
          background: 'var(--color-danger-default)',
        }}
      >
        {display}
      </span>
    );
  }

  if (variant === 'role') {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
          className
        )}
        style={{
          background: color ? `${color}22` : 'var(--color-accent-muted)',
          color: color ?? 'var(--color-text-accent)',
          border: `1px solid ${color ? `${color}44` : 'transparent'}`,
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
        className
      )}
      style={{
        background: 'var(--color-surface-raised)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      {children}
    </span>
  );
}
