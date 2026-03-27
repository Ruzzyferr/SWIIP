'use client';

import {
  Mic,
  MicOff,
  Headphones,
  EarOff,
  PhoneOff,
  Loader2,
  AlertTriangle,
  Phone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { useVoiceStore, type VoiceParticipant } from '@/stores/voice.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useAuthStore } from '@/stores/auth.store';
import { useVoiceActions } from '@/hooks/useVoiceActions';

// ---------------------------------------------------------------------------
// Participant Tile
// ---------------------------------------------------------------------------

function ParticipantTile({
  participant,
  guildId,
  isCurrentUser,
}: {
  participant: VoiceParticipant;
  guildId: string;
  isCurrentUser: boolean;
}) {
  const members = useGuildsStore((s) => s.members[guildId]);
  const member = members?.[participant.userId];
  const displayName =
    member?.nick ?? member?.user?.globalName ?? member?.user?.username ?? participant.userId;

  const isSpeaking = participant.speaking && !participant.selfMute;
  const borderColor = isSpeaking
    ? 'var(--color-voice-speaking)'
    : participant.selfDeaf
    ? 'var(--color-voice-deafened)'
    : 'transparent';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center gap-2 p-4 rounded-xl"
      style={{
        background: 'var(--color-surface-raised)',
        border: `2px solid ${borderColor}`,
        minWidth: 120,
        maxWidth: 160,
        transition: 'border-color 0.2s',
      }}
    >
      {/* Avatar with speaking ring */}
      <div className="relative">
        <div
          className="rounded-full transition-shadow duration-200"
          style={{
            boxShadow: isSpeaking ? '0 0 12px var(--color-voice-speaking)' : 'none',
          }}
        >
          <Avatar
            src={member?.user?.avatar ?? (member?.user as { avatarId?: string } | undefined)?.avatarId}
            userId={participant.userId}
            displayName={displayName}
            size="xl"
          />
        </div>

        {/* Mute/Deaf indicator badge */}
        {(participant.selfMute || participant.selfDeaf) && (
          <div
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: 'var(--color-surface-overlay)',
              border: '2px solid var(--color-surface-raised)',
            }}
          >
            {participant.selfDeaf ? (
              <EarOff size={12} style={{ color: 'var(--color-danger-default)' }} />
            ) : (
              <MicOff size={12} style={{ color: 'var(--color-danger-default)' }} />
            )}
          </div>
        )}
      </div>

      {/* Name */}
      <span
        className="text-sm font-medium truncate w-full text-center"
        style={{
          color: isSpeaking
            ? 'var(--color-voice-speaking)'
            : 'var(--color-text-primary)',
        }}
      >
        {displayName}
        {isCurrentUser && (
          <span style={{ color: 'var(--color-text-tertiary)' }}> (you)</span>
        )}
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

interface VoiceRoomViewProps {
  channelId: string;
  guildId: string;
}

export function VoiceRoomView({ channelId, guildId }: VoiceRoomViewProps) {
  const connectionState = useVoiceStore((s) => s.connectionState);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const selfMuted = useVoiceStore((s) => s.selfMuted);
  const selfDeafened = useVoiceStore((s) => s.selfDeafened);
  const error = useVoiceStore((s) => s.error);
  const participants = useVoiceStore((s) => s.getChannelParticipants(channelId));
  const channel = useGuildsStore((s) => s.channels[channelId]);
  const userId = useAuthStore((s) => s.user?.id);
  const { joinVoiceChannel, leaveVoiceChannel, toggleMute, toggleDeafen } =
    useVoiceActions();

  const isInThisChannel = currentChannelId === channelId;
  const isConnected = isInThisChannel && connectionState === 'connected';
  const isConnecting =
    isInThisChannel &&
    (connectionState === 'connecting' || connectionState === 'reconnecting');
  const hasError = isInThisChannel && connectionState === 'error';

  const btnClass =
    'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200';

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
      style={{ background: 'var(--color-surface-base)' }}
    >
      {/* Channel name */}
      <div className="text-center">
        <h2
          className="text-xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {channel?.name ?? 'Voice Channel'}
        </h2>
        {channel?.userLimit ? (
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {participants.length} / {channel.userLimit} participants
          </p>
        ) : (
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Status messages */}
      {isConnecting && (
        <div className="flex items-center gap-2" style={{ color: 'var(--color-status-idle)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">
            {connectionState === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}
          </span>
        </div>
      )}

      {hasError && (
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-lg"
          style={{
            background: 'var(--color-danger-muted)',
            color: 'var(--color-danger-default)',
          }}
        >
          <AlertTriangle size={16} />
          <span className="text-sm">{error ?? 'Failed to connect to voice channel'}</span>
        </div>
      )}

      {/* Participant grid */}
      {participants.length > 0 && (
        <div className="flex flex-wrap gap-4 justify-center max-w-3xl">
          <AnimatePresence mode="popLayout">
            {participants.map((p) => (
              <ParticipantTile
                key={p.userId}
                participant={p}
                guildId={guildId}
                isCurrentUser={p.userId === userId}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state when nobody's in the channel and we're not connected */}
      {!isInThisChannel && participants.length === 0 && (
        <div className="text-center space-y-2">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ background: 'var(--color-surface-raised)' }}
          >
            <Phone size={28} style={{ color: 'var(--color-text-tertiary)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            No one is in this voice channel.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mt-2">
        {!isInThisChannel ? (
          <button
            onClick={() => joinVoiceChannel(channelId)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-sm transition-all duration-200"
            style={{
              background: 'var(--color-accent-primary)',
              color: '#fff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-accent-primary)';
            }}
          >
            <Phone size={16} />
            Join Voice
          </button>
        ) : (
          <>
            <Tooltip content={selfMuted ? 'Unmute' : 'Mute'} placement="top">
              <button
                onClick={toggleMute}
                className={btnClass}
                style={{
                  color: selfMuted
                    ? '#fff'
                    : 'var(--color-text-primary)',
                  background: selfMuted
                    ? 'var(--color-danger-default)'
                    : 'var(--color-surface-raised)',
                }}
                onMouseEnter={(e) => {
                  if (!selfMuted) e.currentTarget.style.background = 'var(--color-surface-overlay)';
                }}
                onMouseLeave={(e) => {
                  if (!selfMuted) e.currentTarget.style.background = 'var(--color-surface-raised)';
                }}
                aria-label={selfMuted ? 'Unmute' : 'Mute'}
              >
                {selfMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            </Tooltip>

            <Tooltip content={selfDeafened ? 'Undeafen' : 'Deafen'} placement="top">
              <button
                onClick={toggleDeafen}
                className={btnClass}
                style={{
                  color: selfDeafened
                    ? '#fff'
                    : 'var(--color-text-primary)',
                  background: selfDeafened
                    ? 'var(--color-danger-default)'
                    : 'var(--color-surface-raised)',
                }}
                onMouseEnter={(e) => {
                  if (!selfDeafened) e.currentTarget.style.background = 'var(--color-surface-overlay)';
                }}
                onMouseLeave={(e) => {
                  if (!selfDeafened) e.currentTarget.style.background = 'var(--color-surface-raised)';
                }}
                aria-label={selfDeafened ? 'Undeafen' : 'Deafen'}
              >
                {selfDeafened ? <EarOff size={20} /> : <Headphones size={20} />}
              </button>
            </Tooltip>

            <Tooltip content="Disconnect" placement="top">
              <button
                onClick={leaveVoiceChannel}
                className={btnClass}
                style={{
                  color: '#fff',
                  background: 'var(--color-danger-default)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                aria-label="Disconnect"
              >
                <PhoneOff size={20} />
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
