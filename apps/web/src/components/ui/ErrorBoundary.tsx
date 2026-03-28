'use client';

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-3 p-6 text-center"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <AlertTriangle size={32} style={{ color: 'var(--color-warning-default, #f0a020)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </p>
          <p className="text-xs max-w-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-subtle)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-overlay)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
          >
            <RefreshCw size={12} />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
