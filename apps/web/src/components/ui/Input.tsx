'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  helperText?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      error,
      helperText,
      prefix,
      suffix,
      containerClassName,
      className,
      id,
      disabled,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) {
    const [focused, setFocused] = useState(false);
    const hasError = Boolean(error);
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {label}
          </label>
        )}

        <div
          className="flex items-center rounded-lg transition-all duration-fast overflow-hidden"
          style={{
            background: 'var(--color-surface-raised)',
            border: hasError
              ? '1px solid var(--color-danger-default)'
              : focused
              ? '1px solid var(--color-border-focus)'
              : '1px solid var(--color-border-default)',
            boxShadow: focused
              ? hasError
                ? '0 0 0 3px rgba(239,68,68,0.15)'
                : '0 0 0 3px rgba(16,185,129,0.15)'
              : 'none',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {prefix && (
            <div
              className="flex items-center pl-3 shrink-0"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {prefix}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              'flex-1 px-3 py-2.5 bg-transparent text-sm outline-none w-full',
              'placeholder:text-[var(--color-text-disabled)]',
              'disabled:cursor-not-allowed',
              prefix && 'pl-1.5',
              suffix && 'pr-1.5',
              className
            )}
            style={{ color: 'var(--color-text-primary)' }}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />

          {suffix && (
            <div
              className="flex items-center pr-3 shrink-0"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {suffix}
            </div>
          )}
        </div>

        {(error || helperText) && (
          <p
            className="text-xs"
            style={{
              color: hasError
                ? 'var(--color-danger-default)'
                : 'var(--color-text-tertiary)',
            }}
          >
            {error ?? helperText}
          </p>
        )}
      </div>
    );
  }
);
