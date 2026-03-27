'use client';

import { useMemo, useRef } from 'react';
import { MicOff, EarOff } from 'lucide-react';
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

  const speakingRing = participant.speaking && !participant.selfMute
    ? '2px solid var(--color-voice-speaking)'
    : participant.speaking && participant.selfMute
    ? '2px solid var(--color-voice-mutedSpeaking)'
    : '2px solid transparent';

  return (
    <div
      className="flex items-center gap-1.5 py-0.5 px-1.5 rounded transition-colors duration-100"
      style={{ marginLeft: 8 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-surface-raised)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div
        className="rounded-full flex-shrink-0"
        style={{ border: speakingRing, padding: 1 }}
      >
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
    </div>
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
      {participants.map((p) => (
        <ParticipantRow key={p.userId} participant={p} guildId={guildId} />
      ))}
    </div>
  );
}
