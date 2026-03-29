'use client';

import { useState } from 'react';
import { Mic, MicOff, Headphones, EarOff, Settings } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { StatusPicker } from '@/components/ui/StatusPicker';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { useUIStore } from '@/stores/ui.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useVoiceActions } from '@/hooks/useVoiceActions';

export function UserPanel() {
  const user = useAuthStore((s) => s.user);
  const openSettings = useUIStore((s) => s.openSettings);
  const getPresence = usePresenceStore((s) => s.getPresence);
  const customStatus = usePresenceStore((s) => user?.id ? s.users[user.id]?.customStatus : undefined);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const connectionState = useVoiceStore((s) => s.connectionState);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const isSpeaking = useVoiceStore((s) => {
    if (!currentChannelId || !user?.id) return false;
    const key = `${currentChannelId}:${user.id}`;
    return s.participants[key]?.speaking === true && !s.selfMuted;
  });
  const { toggleMute, toggleDeafen } = useVoiceActions();
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  if (!user) return null;

  const status = user.id ? getPresence(user.id) : 'offline';
  const displayName = user.globalName ?? user.username;
  const isInVoice = connectionState === 'connected' || connectionState === 'connecting' || connectionState === 'reconnecting';

  const iconButtonStyle = (active: boolean) => ({
    color: active ? 'var(--color-danger-default)' : 'var(--color-text-secondary)',
    background: active ? 'var(--color-danger-muted)' : 'transparent',
  });

  return (
    <div
      className="flex items-center gap-2 px-2"
      style={{
        minHeight: '52px',
        paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderTop: '1px solid var(--color-border-subtle)',
      }}
    >
      {/* Avatar (opens status picker) + name (opens settings) */}
      <div className="flex items-center gap-2 flex-1 min-w-0 relative">
        {/* Avatar — opens StatusPicker */}
        <button
          className="rounded-full transition-shadow duration-200 flex-shrink-0"
          style={{
            boxShadow: isSpeaking ? '0 0 0 2px var(--color-voice-speaking, #43b581)' : 'none',
            borderRadius: '50%',
          }}
          onClick={() => setShowStatusPicker(!showStatusPicker)}
          aria-label="Set status"
        >
          <Avatar
            src={user.avatar}
            userId={user.id}
            displayName={displayName}
            size="sm"
            status={status}
          />
        </button>

        {/* Name — opens settings */}
        <button
          className="flex-1 min-w-0 text-left rounded-lg px-1.5 py-1 transition-all duration-fast"
          style={{ color: 'var(--color-text-primary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-surface-overlay)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          onClick={() => openSettings('account')}
          aria-label="Open account settings"
        >
          <p
            className="text-sm font-semibold truncate leading-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {displayName}
          </p>
          <p
            className="text-xs truncate leading-tight"
            style={{ color: customStatus ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)' }}
          >
            {customStatus || `@${user.username}`}
          </p>
        </button>

        {/* Status Picker Popover */}
        {showStatusPicker && (
          <StatusPicker onClose={() => setShowStatusPicker(false)} />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-0.5">
        <Tooltip content={selfMuted ? 'Unmute' : 'Mute'} placement="top">
          <button
            onClick={toggleMute}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-fast"
            style={iconButtonStyle(selfMuted)}
            onMouseEnter={(e) => {
              if (!selfMuted) {
                e.currentTarget.style.background = 'var(--color-surface-overlay)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = selfMuted
                ? 'var(--color-danger-muted)'
                : 'transparent';
              e.currentTarget.style.color = selfMuted
                ? 'var(--color-danger-default)'
                : 'var(--color-text-secondary)';
            }}
            aria-label={selfMuted ? 'Unmute microphone' : 'Mute microphone'}
            aria-pressed={selfMuted}
          >
            {selfMuted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        </Tooltip>

        <Tooltip content={selfDeafened ? 'Undeafen' : 'Deafen'} placement="top">
          <button
            onClick={toggleDeafen}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-fast"
            style={iconButtonStyle(selfDeafened)}
            onMouseEnter={(e) => {
              if (!selfDeafened) {
                e.currentTarget.style.background = 'var(--color-surface-overlay)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = selfDeafened
                ? 'var(--color-danger-muted)'
                : 'transparent';
              e.currentTarget.style.color = selfDeafened
                ? 'var(--color-danger-default)'
                : 'var(--color-text-secondary)';
            }}
            aria-label={selfDeafened ? 'Undeafen' : 'Deafen'}
            aria-pressed={selfDeafened}
          >
            {selfDeafened ? <EarOff size={15} /> : <Headphones size={15} />}
          </button>
        </Tooltip>

        <Tooltip content="Settings" placement="top">
          <button
            onClick={() => openSettings()}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-fast"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-surface-overlay)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
            aria-label="Open settings"
          >
            <Settings size={15} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
