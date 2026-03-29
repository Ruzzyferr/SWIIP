'use client';

import { useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MicOff, EarOff, Video, Monitor } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useVoiceStore, type VoiceParticipant } from '@/stores/voice.store';
import { useGuildsStore } from '@/stores/guilds.store';

interface VoiceChannelUsersProps {
  channelId: string;
  guildId: string;
}

function ParticipantRow({ participant, guildId }: { participant: VoiceParticipant; guildId: string }) {
  const members = useGuildsStore((s) => s.members[guildId]);
  const member = members?.[participant.userId];
  const displayName = member?.nick ?? member?.user?.globalName ?? member?.user?.username ?? participant.userId;

  const isSpeaking = participant.speaking && !participant.selfMute;
  const isMutedSpeaking = participant.speaking && participant.selfMute;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="flex items-center gap-1.5 py-0.5 px-1.5 rounded transition-colors duration-100"
      style={{ marginLeft: 8 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-surface-raised)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div className="relative rounded-full flex-shrink-0">
        {/* Animated speaking waveform ring */}
        {isSpeaking && (
          <motion.div
            className="absolute inset-[-3px] rounded-full"
            style={{
              border: '2px solid var(--color-voice-speaking)',
              boxShadow: '0 0 8px rgba(34, 197, 94, 0.4)',
            }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
        {isMutedSpeaking && (
          <div
            className="absolute inset-[-3px] rounded-full"
            style={{ border: '2px solid var(--color-voice-mutedSpeaking)' }}
          />
        )}
        <Avatar
          src={member?.user?.avatar ?? (member?.user as { avatarId?: string } | undefined)?.avatarId}
          userId={participant.userId}
          displayName={displayName}
          size="xs"
        />
      </div>
      <span
        className="text-xs truncate flex-1"
        style={{
          color: participant.speaking
            ? 'var(--color-text-primary)'
            : 'var(--color-text-secondary)',
        }}
      >
        {displayName}
      </span>

      {/* State icons */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {participant.screenSharing && (
          <motion.span
            className="flex items-center gap-0.5"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Monitor size={10} style={{ color: '#ef4444' }} />
            <span className="text-[8px] font-bold text-red-400 uppercase">LIVE</span>
          </motion.span>
        )}
        {participant.selfVideo && !participant.screenSharing && (
          <Video size={11} style={{ color: 'var(--color-success-default)' }} />
        )}
        {participant.selfMute && (
          <MicOff
            size={11}
            style={{
              color: participant.serverMute
                ? 'var(--color-danger-default)'
                : 'var(--color-text-tertiary)',
            }}
          />
        )}
        {participant.selfDeaf && (
          <EarOff
            size={11}
            style={{ color: 'var(--color-text-tertiary)' }}
          />
        )}
      </div>
    </motion.div>
  );
}

export function VoiceChannelUsers({ channelId, guildId }: VoiceChannelUsersProps) {
  // Stable selector: avoid creating a new array on every unrelated store change
  const participantsRaw = useVoiceStore((s) => s.participants);
  const prevRef = useRef<VoiceParticipant[]>([]);
  const participants = useMemo(() => {
    const filtered = Object.values(participantsRaw).filter(
      (p) => p.channelId === channelId,
    );
    const prev = prevRef.current;
    if (
      prev.length === filtered.length &&
      prev.every((p, i) => p === filtered[i])
    ) {
      return prev;
    }
    prevRef.current = filtered;
    return filtered;
  }, [participantsRaw, channelId]);

  if (participants.length === 0) return null;

  return (
    <div className="mt-0.5 mb-1">
      <AnimatePresence>
        {participants.map((p) => (
          <ParticipantRow key={p.userId} participant={p} guildId={guildId} />
        ))}
      </AnimatePresence>
    </div>
  );
}
