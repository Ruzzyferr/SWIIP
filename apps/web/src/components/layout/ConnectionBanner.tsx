'use client';

import { useGatewayStore } from '@/stores/gateway.store';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export function ConnectionBanner() {
  const status = useGatewayStore((s) => s.status);

  if (status === 'connected') return null;

  const config = {
    disconnected: {
      icon: <WifiOff size={14} />,
      text: 'No internet connection — retrying...',
      bg: 'var(--color-danger-default)',
    },
    connecting: {
      icon: <Loader2 size={14} className="animate-spin" />,
      text: 'Connecting...',
      bg: 'var(--color-warning-default, #f0a020)',
    },
    reconnecting: {
      icon: <Loader2 size={14} className="animate-spin" />,
      text: 'Reconnecting...',
      bg: 'var(--color-warning-default, #f0a020)',
    },
  }[status];

  if (!config) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-1 text-xs font-medium text-white shrink-0"
      style={{ background: config.bg }}
    >
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
}
