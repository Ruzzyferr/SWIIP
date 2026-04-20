'use client';

import { useState } from 'react';
import { UserPlus, Link2, Check, Sparkles, Volume2, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import { useVoiceStore } from '@/stores/voice.store';
import { useUIStore } from '@/stores/ui.store';
import { createInvite } from '@/lib/api/guilds.api';
import { toastSuccess, toastError } from '@/lib/toast';

interface EmptyRoomStageProps {
  channelName: string;
  channelId: string;
  guildId: string;
  capacity?: number | null;
  isConnected: boolean;
}

const AUDIO_MODE_LABEL: Record<string, string> = {
  standard: 'Standard',
  enhanced: 'Enhanced (RNNoise)',
  raw: 'Raw',
  music: 'Music',
};

const QUALITY_LABEL = ['Lost', 'Poor', 'Good', 'Excellent'];

export function EmptyRoomStage({
  channelName,
  channelId,
  guildId,
  capacity,
  isConnected,
}: EmptyRoomStageProps) {
  const audioMode = useVoiceStore((s) => s.settings.audioMode);
  const connectionQuality = useVoiceStore((s) => s.connectionQuality);
  const openModal = useUIStore((s) => s.openModal);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDM = guildId === 'dm' || !guildId;

  const handleInvite = () => {
    if (isDM) return;
    openModal('invite', { guildId, channelId });
  };

  const handleCopyLink = async () => {
    if (isDM || copying) return;
    setCopying(true);
    try {
      const invite = await createInvite(guildId, channelId, {
        maxAge: 86400,
        maxUses: 0,
      });
      const url = `${window.location.origin}/invite/${invite.code}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toastSuccess('Invite link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastError('Could not create invite link');
    } finally {
      setCopying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative w-full max-w-xl mx-auto rounded-3xl overflow-hidden"
      style={{
        padding: '32px 28px',
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        boxShadow: 'var(--shadow-float)',
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, var(--ambient-primary-subtle, rgba(16,185,129,0.18)) 0%, transparent 65%)',
        }}
      />

      <div className="relative flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <h3
              className="text-base sm:text-lg font-semibold truncate max-w-[280px]"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {channelName}
            </h3>
            {isConnected && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: 'var(--color-accent-muted)',
                  color: 'var(--color-accent-primary)',
                  border: '1px solid var(--color-accent-primary)',
                }}
              >
                LIVE
              </span>
            )}
          </div>
          {capacity != null && (
            <span
              className="text-xs"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              1/{capacity} connected
            </span>
          )}
        </div>

        <PulsingRing />

        <p
          className="text-sm text-center max-w-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {isConnected
            ? 'Waiting for others to join. Invite a teammate to get started.'
            : 'Nobody is here yet. Jump in whenever you are ready.'}
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <InfoChip
            icon={<Sparkles size={12} />}
            label={AUDIO_MODE_LABEL[audioMode] ?? audioMode}
          />
          <InfoChip icon={<Volume2 size={12} />} label="High bitrate" />
          {isConnected && (
            <InfoChip
              icon={<Wifi size={12} />}
              label={QUALITY_LABEL[connectionQuality] ?? 'Connecting'}
            />
          )}
        </div>

        {!isDM && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleInvite}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
              style={{
                background: 'var(--color-accent-primary)',
                color: '#fff',
                boxShadow: '0 8px 24px -10px var(--color-accent-primary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-accent-primary)';
              }}
            >
              <UserPlus size={15} />
              Invite people
            </button>
            <button
              onClick={handleCopyLink}
              disabled={copying}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200"
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--glass-border)',
                opacity: copying ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!copying)
                  e.currentTarget.style.background = 'var(--color-surface-overlay)';
              }}
              onMouseLeave={(e) => {
                if (!copying)
                  e.currentTarget.style.background = 'var(--color-surface-raised)';
              }}
            >
              {copied ? <Check size={14} /> : <Link2 size={14} />}
              {copied ? 'Copied' : 'Copy invite link'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PulsingRing() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          border: '1px solid var(--color-accent-primary)',
          opacity: 0.4,
        }}
        animate={{ scale: [1, 1.6], opacity: [0.45, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
      />
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          border: '1px solid var(--color-accent-primary)',
          opacity: 0.3,
        }}
        animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
        transition={{
          duration: 2.2,
          repeat: Infinity,
          ease: 'easeOut',
          delay: 1.1,
        }}
      />
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: 56,
          height: 56,
          background:
            'radial-gradient(circle at 30% 30%, var(--color-accent-hover) 0%, var(--color-accent-primary) 100%)',
          boxShadow: '0 12px 32px -8px var(--color-accent-primary)',
        }}
      >
        <UserPlus size={22} color="#fff" />
      </div>
    </div>
  );
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
      style={{
        background: 'var(--color-surface-raised)',
        color: 'var(--color-text-tertiary)',
        border: '1px solid var(--glass-border)',
      }}
    >
      <span style={{ color: 'var(--color-accent-primary)' }}>{icon}</span>
      {label}
    </span>
  );
}
