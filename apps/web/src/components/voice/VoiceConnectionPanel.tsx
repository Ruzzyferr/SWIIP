'use client';

import {
  PhoneOff,
  Mic,
  MicOff,
  Headphones,
  EarOff,
  Loader2,
  AlertTriangle,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
} from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useVoiceStore } from '@/stores/voice.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useVoiceActions } from '@/hooks/useVoiceActions';
import { useTranslations } from 'next-intl';

/** Discord-style signal bars (4 bars, colored by quality level) */
function ConnectionQualityBars({ quality }: { quality: number }) {
  // quality: 0=LOST, 1=POOR, 2=GOOD, 3=EXCELLENT
  const color =
    quality >= 3
      ? 'var(--color-status-online)'   // green
      : quality === 2
      ? 'var(--color-status-online)'   // green
      : quality === 1
      ? 'var(--color-status-idle)'     // yellow
      : 'var(--color-danger-default)'; // red

  const label =
    quality >= 3 ? 'Excellent' : quality === 2 ? 'Good' : quality === 1 ? 'Poor' : 'Lost';

  const barHeights = [4, 7, 10, 13];

  return (
    <Tooltip content={`Connection: ${label}`} placement="top">
      <div className="flex items-end gap-[2px] cursor-default" style={{ height: 14 }}>
        {barHeights.map((h, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 1,
              background: i < quality ? color : 'var(--color-text-tertiary)',
              opacity: i < quality ? 1 : 0.3,
              transition: 'background 0.3s, opacity 0.3s',
            }}
          />
        ))}
      </div>
    </Tooltip>
  );
}

/**
 * Compact voice connection status panel shown above the UserPanel
 * when the user is connected to (or connecting to) a voice channel.
 */
export function VoiceConnectionPanel() {
  const t = useTranslations('voice');
  const connectionState = useVoiceStore((s) => s.connectionState);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const cameraEnabled = useVoiceStore((s) => s.cameraEnabled);
  const screenShareEnabled = useVoiceStore((s) => s.screenShareEnabled);
  const error = useVoiceStore((s) => s.error);
  const connectionQuality = useVoiceStore((s) => s.connectionQuality);
  const aloneTimeout = useVoiceStore((s) => s.aloneTimeout);
  const channel = useGuildsStore((s) =>
    currentChannelId ? s.channels[currentChannelId] : null
  );
  const { leaveVoiceChannel, toggleMute, toggleDeafen, toggleCamera, toggleScreenShare } = useVoiceActions();

  if (connectionState === 'disconnected' && !currentChannelId) return null;

  const statusText =
    connectionState === 'connecting'
      ? t('connecting')
      : connectionState === 'reconnecting'
      ? t('reconnecting')
      : connectionState === 'error'
      ? t('disconnected')
      : t('connected');

  const statusColor =
    connectionState === 'connected'
      ? 'var(--color-status-online)'
      : connectionState === 'error'
      ? 'var(--color-danger-default)'
      : 'var(--color-status-idle)';

  const isTransitioning =
    connectionState === 'connecting' || connectionState === 'reconnecting';

  const btnClass =
    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150';

  const aloneMinutes = aloneTimeout != null ? Math.ceil(aloneTimeout / 60) : null;
  const aloneSeconds = aloneTimeout != null ? aloneTimeout % 60 : null;

  return (
    <div
      className="px-2 py-2.5 space-y-2 relative overflow-hidden"
      style={{
        borderTop: '1px solid var(--color-border-subtle)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
      }}
    >
      {/* Ambient stage glow */}
      {connectionState === 'connected' && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: -30,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 200,
            height: 80,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.12), transparent 70%)',
            filter: 'blur(20px)',
          }}
        />
      )}

      {/* Alone timeout warning */}
      {aloneTimeout != null && aloneTimeout <= 60 && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
          style={{
            background: 'var(--color-danger-muted)',
            color: 'var(--color-danger-default)',
            border: '1px solid rgba(255,84,112,0.15)',
          }}
        >
          <AlertTriangle size={12} />
          <span>{t('aloneWarning')} ({aloneTimeout}s)</span>
        </div>
      )}

      {/* Status line */}
      <div className="flex items-center gap-2 px-1 relative">
        {isTransitioning ? (
          <Loader2
            size={14}
            style={{ color: statusColor, flexShrink: 0 }}
            className="animate-spin"
          />
        ) : connectionState === 'error' ? (
          <AlertTriangle size={14} style={{ color: statusColor, flexShrink: 0 }} />
        ) : (
          <ConnectionQualityBars quality={connectionQuality} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate" style={{ color: statusColor, letterSpacing: '-0.01em' }}>
            {statusText}
          </p>
          {channel && (
            <p
              className="text-xs truncate"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {channel.name}
              {aloneTimeout != null && aloneTimeout > 60 && (
                <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 4 }}>
                  · alone ({aloneMinutes}m)
                </span>
              )}
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
      <div className="flex items-center justify-center gap-1.5 relative">
        <Tooltip content={selfMuted ? t('unmute') : t('mute')} placement="top">
          <button
            onClick={toggleMute}
            className={btnClass}
            style={{
              color: selfMuted
                ? 'var(--color-danger-default)'
                : 'var(--color-text-secondary)',
              background: selfMuted
                ? 'var(--color-danger-muted)'
                : 'rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: selfMuted ? '0 0 8px rgba(255,84,112,0.2)' : 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!selfMuted) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!selfMuted) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
            aria-label={selfMuted ? t('unmute') : t('mute')}
            aria-pressed={selfMuted}
          >
            {selfMuted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        </Tooltip>

        <Tooltip content={selfDeafened ? t('undeafen') : t('deafen')} placement="top">
          <button
            onClick={toggleDeafen}
            className={btnClass}
            style={{
              color: selfDeafened
                ? 'var(--color-danger-default)'
                : 'var(--color-text-secondary)',
              background: selfDeafened
                ? 'var(--color-danger-muted)'
                : 'rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: selfDeafened ? '0 0 8px rgba(255,84,112,0.2)' : 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!selfDeafened) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!selfDeafened) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
            aria-label={selfDeafened ? t('undeafen') : t('deafen')}
            aria-pressed={selfDeafened}
          >
            {selfDeafened ? <EarOff size={15} /> : <Headphones size={15} />}
          </button>
        </Tooltip>

        <Tooltip content={cameraEnabled ? t('cameraOff') : t('cameraOn')} placement="top">
          <button
            onClick={toggleCamera}
            className={btnClass}
            style={{
              color: cameraEnabled
                ? 'var(--color-success-default)'
                : 'var(--color-text-secondary)',
              background: cameraEnabled
                ? 'var(--color-success-muted, rgba(87, 242, 135, 0.15))'
                : 'rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: cameraEnabled ? '0 0 8px rgba(87,242,135,0.2)' : 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!cameraEnabled) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!cameraEnabled) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
            aria-label={cameraEnabled ? t('cameraOff') : t('cameraOn')}
            aria-pressed={cameraEnabled}
          >
            {cameraEnabled ? <Video size={15} /> : <VideoOff size={15} />}
          </button>
        </Tooltip>

        <Tooltip content={screenShareEnabled ? 'Stop Sharing' : 'Share Screen'} placement="top">
          <button
            onClick={() => toggleScreenShare()}
            className={btnClass}
            style={{
              color: screenShareEnabled
                ? 'var(--color-danger-default)'
                : 'var(--color-text-secondary)',
              background: screenShareEnabled
                ? 'var(--color-danger-muted)'
                : 'rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: screenShareEnabled ? '0 0 8px rgba(255,84,112,0.2)' : 'none',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!screenShareEnabled) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!screenShareEnabled) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
            aria-label={screenShareEnabled ? t('screenShareStop') : t('screenShare')}
            aria-pressed={screenShareEnabled}
          >
            {screenShareEnabled ? <MonitorOff size={15} /> : <Monitor size={15} />}
          </button>
        </Tooltip>

        {/* Disconnect — prominent red */}
        <Tooltip content={t('disconnect')} placement="top">
          <button
            onClick={leaveVoiceChannel}
            className={btnClass}
            style={{
              color: '#fff',
              background: 'var(--color-danger-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 0 12px rgba(255,84,112,0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 16px rgba(255,84,112,0.5)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 12px rgba(255,84,112,0.3)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            aria-label={t('disconnect')}
          >
            <PhoneOff size={15} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
