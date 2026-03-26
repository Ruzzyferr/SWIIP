'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children?: ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-accent-primary)',
    color: '#ffffff',
  },
  secondary: {
    background: 'var(--color-surface-raised)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-default)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
  },
  danger: {
    background: 'var(--color-danger-default)',
    color: '#ffffff',
  },
};

const variantHoverStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: 'var(--color-accent-hover)' },
  secondary: {
    background: 'var(--color-surface-overlay)',
    borderColor: 'var(--color-border-strong)',
  },
  ghost: {
    background: 'var(--color-surface-raised)',
    color: 'var(--color-text-primary)',
  },
  danger: { background: 'var(--color-danger-hover)' },
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      children,
      disabled,
      className,
      onMouseEnter,
      onMouseLeave,
      style,
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium',
          'transition-all duration-fast select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-surface-base)]',
          sizeClasses[size],
          fullWidth && 'w-full',
          isDisabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        style={{ ...variantStyles[variant], ...style }}
        onMouseEnter={(e) => {
          if (!isDisabled) {
            const styles = variantHoverStyles[variant];
            for (const [k, v] of Object.entries(styles)) {
              (e.currentTarget.style as unknown as Record<string, string>)[k] = v as string;
            }
          }
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (!isDisabled) {
            const styles = variantStyles[variant];
            for (const [k, v] of Object.entries(styles)) {
              (e.currentTarget.style as unknown as Record<string, string>)[k] = v as string;
            }
          }
          onMouseLeave?.(e);
        }}
        {...props}
      >
        {loading ? (
          <Spinner size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} />
        ) : (
          iconPosition === 'left' && icon
        )}
        {children && (
          <span className={loading ? 'ml-1.5' : undefined}>{children}</span>
        )}
        {!loading && iconPosition === 'right' && icon}
      </button>
    );
  }
);
