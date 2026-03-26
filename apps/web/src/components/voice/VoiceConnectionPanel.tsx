'use client';

import {
  PhoneOff,
  Mic,
  MicOff,
  Headphones,
  EarOff,
  Signal,
  SignalLow,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useVoiceStore } from '@/stores/voice.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useVoiceActions } from '@/hooks/useVoiceActions';

/**
 * Compact voice connection status panel shown above the UserPanel
 * when the user is connected to (or connecting to) a voice channel.
 */
export function VoiceConnectionPanel() {
  const connectionState = useVoiceStore((s) => s.connectionState);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const error = useVoiceStore((s) => s.error);
  const channel = useGuildsStore((s) =>
    currentChannelId ? s.channels[currentChannelId] : null
  );
  const { leaveVoiceChannel, toggleMute, toggleDeafen } = useVoiceActions();

  if (connectionState === 'disconnected' && !currentChannelId) return null;

  const statusText =
    connectionState === 'connecting'
      ? 'Connecting...'
      : connectionState === 'reconnecting'
      ? 'Reconnecting...'
      : connectionState === 'error'
      ? 'Connection Error'
      : 'Voice Connected';

  const statusColor =
    connectionState === 'connected'
      ? 'var(--color-status-online)'
      : connectionState === 'error'
      ? 'var(--color-danger-default)'
      : 'var(--color-status-idle)';

  const StatusIcon =
    connectionState === 'connecting' || connectionState === 'reconnecting'
      ? Loader2
      : connectionState === 'error'
      ? AlertTriangle
      : connectionState === 'connected'
      ? Signal
      : SignalLow;

  const btnClass =
    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150';

  return (
    <div
      className="px-2 py-2 space-y-1.5"
      style={{
        borderTop: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface-raised)',
      }}
    >
      {/* Status line */}
      <div className="flex items-center gap-2 px-1">
        <StatusIcon
          size={14}
          style={{ color: statusColor, flexShrink: 0 }}
          className={
            connectionState === 'connecting' || connectionState === 'reconnecting'
              ? 'animate-spin'
              : ''
          }
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: statusColor }}>
            {statusText}
          </p>
          {channel && (
            <p
              className="text-xs truncate"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {channel.name}
            </p>
          )}
          {error && (
            <p
              className="text-xs truncate"
              style={{ color: 'var(--color-danger-default)' }}
            >
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-1">
        <Tooltip content={selfMuted ? 'Unmute' : 'Mute'} placement="top">
          <button
            onClick={toggleMute}
            className={btnClass}
            style={{
              color: selfMuted
                ? 'var(--color-danger-default)'
                : 'var(--color-text-secondary)',
              background: selfMuted
                ? 'var(--color-danger-muted)'
                : 'var(--color-surface-overlay)',
            }}
            aria-label={selfMuted ? 'Unmute' : 'Mute'}
          >
            {selfMuted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        </Tooltip>

        <Tooltip content={selfDeafened ? 'Undeafen' : 'Deafen'} placement="top">
          <button
            onClick={toggleDeafen}
            className={btnClass}
            style={{
              color: selfDeafened
                ? 'var(--color-danger-default)'
                : 'var(--color-text-secondary)',
              background: selfDeafened
                ? 'var(--color-danger-muted)'
                : 'var(--color-surface-overlay)',
            }}
            aria-label={selfDeafened ? 'Undeafen' : 'Deafen'}
          >
            {selfDeafened ? <EarOff size={15} /> : <Headphones size={15} />}
          </button>
        </Tooltip>

        <Tooltip content="Disconnect" placement="top">
          <button
            onClick={leaveVoiceChannel}
            className={btnClass}
            style={{
              color: 'var(--color-danger-default)',
              background: 'var(--color-danger-muted)',
            }}
            aria-label="Disconnect from voice"
          >
            <PhoneOff size={15} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
