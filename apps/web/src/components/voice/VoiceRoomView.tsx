'use client';

import { useCallback, useMemo, useRef } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  EarOff,
  PhoneOff,
  Loader2,
  AlertTriangle,
  Phone,
  Volume2,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu';
import { VideoTile } from './VideoTile';
import { useVoiceStore, type VoiceParticipant } from '@/stores/voice.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useAuthStore } from '@/stores/auth.store';
import { useVoiceActions } from '@/hooks/useVoiceActions';
import { useLiveKitContext } from '@/contexts/LiveKitContext';

// ---------------------------------------------------------------------------
// Per-user volume slider (used inside context menu)
// ---------------------------------------------------------------------------

function UserVolumeSlider({ userId }: { userId: string }) {
  const volume = useVoiceStore((s) => s.userVolumes[userId] ?? 100);
  const setUserVolume = useVoiceStore((s) => s.setUserVolume);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUserVolume(userId, Number(e.target.value));
    },
    [userId, setUserVolume],
  );

  return (
    <div className="flex flex-col gap-1.5 min-w-[160px]">
      <div className="flex items-center gap-2">
        <Volume2 size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          User Volume
        </span>
        <span className="text-xs ml-auto tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
          {volume}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={200}
        step={1}
        value={volume}
        onChange={handleChange}
        className="w-full accent-[var(--color-accent-primary)] h-1.5"
        style={{ cursor: 'pointer' }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Participant Tile (audio-only mode — no video)
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

  const contextItems: ContextMenuItem[] = isCurrentUser
    ? []
    : [
        { type: 'label', label: displayName },
        { type: 'separator' },
        {
          type: 'custom',
          customContent: <UserVolumeSlider userId={participant.userId} />,
        },
      ];

  const tile = (
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
        transition: 'border-color 0.1s',
      }}
    >
      {/* Avatar with speaking ring */}
      <div className="relative">
        <div
          className="rounded-full transition-shadow duration-100"
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

        {/* Video indicator badge */}
        {participant.selfVideo && (
          <div
            className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: 'var(--color-surface-overlay)',
              border: '2px solid var(--color-surface-raised)',
            }}
          >
            <Video size={12} style={{ color: 'var(--color-success-default)' }} />
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

  if (isCurrentUser) return tile;

  return (
    <ContextMenu items={contextItems}>
      {tile}
    </ContextMenu>
  );
}

// ---------------------------------------------------------------------------
// Video Grid
// ---------------------------------------------------------------------------

function VideoGrid({
  participants,
  guildId,
}: {
  participants: VoiceParticipant[];
  guildId: string;
}) {
  const { videoTracks } = useLiveKitContext();
  const pinnedId = useVoiceStore((s) => s.pinnedParticipantId);
  const setPinnedParticipant = useVoiceStore((s) => s.setPinnedParticipant);
  const members = useGuildsStore((s) => s.members[guildId]);
  const userId = useAuthStore((s) => s.user?.id);

  // Build list of video tiles (camera + screen shares)
  const tiles = useMemo(() => {
    const result: {
      key: string;
      participantId: string;
      displayName: string;
      avatarUrl?: string;
      track?: MediaStreamTrack;
      isScreen: boolean;
      isMuted: boolean;
      isSpeaking: boolean;
    }[] = [];

    for (const p of participants) {
      const member = members?.[p.userId];
      const name = member?.nick ?? member?.user?.globalName ?? member?.user?.username ?? p.userId;
      const avatar = member?.user?.avatar ?? (member?.user as { avatarId?: string } | undefined)?.avatarId;
      const tracks = videoTracks[p.userId];

      // Screen share tile (always shown first / pinned by default)
      if (tracks?.screen) {
        result.push({
          key: `${p.userId}-screen`,
          participantId: p.userId,
          displayName: name,
          avatarUrl: avatar,
          track: tracks.screen,
          isScreen: true,
          isMuted: p.selfMute,
          isSpeaking: p.speaking && !p.selfMute,
        });
      }

      // Camera tile
      if (tracks?.camera || p.selfVideo) {
        result.push({
          key: `${p.userId}-camera`,
          participantId: p.userId,
          displayName: name + (p.userId === userId ? ' (you)' : ''),
          avatarUrl: avatar,
          track: tracks?.camera,
          isScreen: false,
          isMuted: p.selfMute,
          isSpeaking: p.speaking && !p.selfMute,
        });
      }
    }

    return result;
  }, [participants, videoTracks, members, userId]);

  if (tiles.length === 0) return null;

  // Find pinned tile
  const pinnedTile = pinnedId
    ? tiles.find((t) => t.key === `${pinnedId}-screen` || t.key === `${pinnedId}-camera`)
    : tiles.find((t) => t.isScreen); // Auto-pin first screen share

  const otherTiles = pinnedTile
    ? tiles.filter((t) => t.key !== pinnedTile.key)
    : tiles;

  // Grid column count based on tile count
  const gridCols = otherTiles.length <= 1 ? 1 : otherTiles.length <= 4 ? 2 : 3;

  return (
    <div className="w-full max-w-5xl flex flex-col gap-3">
      {/* Spotlight / pinned view */}
      {pinnedTile && (
        <div className="w-full">
          <VideoTile
            participantId={pinnedTile.participantId}
            displayName={pinnedTile.displayName}
            avatarUrl={pinnedTile.avatarUrl}
            track={pinnedTile.track}
            isScreen={pinnedTile.isScreen}
            isMuted={pinnedTile.isMuted}
            isSpeaking={pinnedTile.isSpeaking}
            isPinned
            onPin={() => setPinnedParticipant(pinnedTile.participantId)}
          />
        </div>
      )}

      {/* Other tiles in grid */}
      {otherTiles.length > 0 && (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          }}
        >
          {otherTiles.map((tile) => (
            <VideoTile
              key={tile.key}
              participantId={tile.participantId}
              displayName={tile.displayName}
              avatarUrl={tile.avatarUrl}
              track={tile.track}
              isScreen={tile.isScreen}
              isMuted={tile.isMuted}
              isSpeaking={tile.isSpeaking}
              isPinned={false}
              onPin={() => setPinnedParticipant(tile.participantId)}
              compact={!!pinnedTile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen Share Quality Selector (right-click for quality options)
// ---------------------------------------------------------------------------

function ScreenShareButton() {
  const screenShareEnabled = useVoiceStore((s) => s.screenShareEnabled);
  const screenShareQuality = useVoiceStore((s) => s.screenShareQuality);
  const { toggleScreenShare } = useVoiceActions();

  const btnClass =
    'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200';

  const contextItems: ContextMenuItem[] = [
    { type: 'label', label: 'Screen Share Quality' },
    { type: 'separator' },
    {
      label: `720p 30fps${screenShareQuality === '720p30' ? ' ✓' : ''}`,
      onClick: () => toggleScreenShare('720p30'),
    },
    {
      label: `1080p 30fps${screenShareQuality === '1080p30' ? ' ✓' : ''}`,
      onClick: () => toggleScreenShare('1080p30'),
    },
    {
      label: `1080p 60fps (Source)${screenShareQuality === '1080p60' ? ' ✓' : ''}`,
      onClick: () => toggleScreenShare('1080p60'),
    },
  ];

  return (
    <ContextMenu items={contextItems}>
      <Tooltip content={screenShareEnabled ? 'Stop Sharing' : 'Share Screen'} placement="top">
        <button
          onClick={() => toggleScreenShare()}
          className={btnClass}
          style={{
            color: screenShareEnabled ? '#fff' : 'var(--color-text-primary)',
            background: screenShareEnabled
              ? 'var(--color-danger-default)'
              : 'var(--color-surface-raised)',
          }}
          onMouseEnter={(e) => {
            if (!screenShareEnabled) e.currentTarget.style.background = 'var(--color-surface-overlay)';
          }}
          onMouseLeave={(e) => {
            if (!screenShareEnabled) e.currentTarget.style.background = 'var(--color-surface-raised)';
          }}
          aria-label={screenShareEnabled ? 'Stop Screen Share' : 'Share Screen'}
        >
          {screenShareEnabled ? <MonitorOff size={20} /> : <Monitor size={20} />}
        </button>
      </Tooltip>
    </ContextMenu>
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
  const cameraEnabled = useVoiceStore((s) => s.cameraEnabled);
  const error = useVoiceStore((s) => s.error);
  // Stable selector: avoid creating new array on every unrelated store change
  const participantsRaw = useVoiceStore((s) => s.participants);
  const prevParticipantsRef = useRef<VoiceParticipant[]>([]);
  const participants = useMemo(() => {
    const filtered = Object.values(participantsRaw).filter(
      (p) => p.channelId === channelId,
    );
    // Shallow-compare to avoid new reference when content hasn't changed
    const prev = prevParticipantsRef.current;
    if (
      prev.length === filtered.length &&
      prev.every((p, i) => p === filtered[i])
    ) {
      return prev;
    }
    prevParticipantsRef.current = filtered;
    return filtered;
  }, [participantsRaw, channelId]);
  const channel = useGuildsStore((s) => s.channels[channelId]);
  const userId = useAuthStore((s) => s.user?.id);
  const { videoTracks } = useLiveKitContext();
  const {
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    toggleDeafen,
    toggleCamera,
  } = useVoiceActions();

  const isInThisChannel = currentChannelId === channelId;
  const isConnecting =
    isInThisChannel &&
    (connectionState === 'connecting' || connectionState === 'reconnecting');
  const hasError = isInThisChannel && connectionState === 'error';

  // Check if any participant has video/screen active
  const hasAnyVideo = useMemo(() => {
    return participants.some(
      (p) => p.selfVideo || p.screenSharing || videoTracks[p.userId]?.camera || videoTracks[p.userId]?.screen,
    );
  }, [participants, videoTracks]);

  const btnClass =
    'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200';

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-6 p-8 overflow-y-auto"
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

      {/* Video grid (when any participant has video/screen) */}
      {hasAnyVideo && (
        <VideoGrid participants={participants} guildId={guildId} />
      )}

      {/* Audio-only participant grid (when no video active) */}
      {!hasAnyVideo && participants.length > 0 && (
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
            {/* Mute */}
            <Tooltip content={selfMuted ? 'Unmute' : 'Mute'} placement="top">
              <button
                onClick={toggleMute}
                className={btnClass}
                style={{
                  color: selfMuted ? '#fff' : 'var(--color-text-primary)',
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

            {/* Deafen */}
            <Tooltip content={selfDeafened ? 'Undeafen' : 'Deafen'} placement="top">
              <button
                onClick={toggleDeafen}
                className={btnClass}
                style={{
                  color: selfDeafened ? '#fff' : 'var(--color-text-primary)',
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

            {/* Camera */}
            <Tooltip content={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'} placement="top">
              <button
                onClick={toggleCamera}
                className={btnClass}
                style={{
                  color: cameraEnabled ? '#fff' : 'var(--color-text-primary)',
                  background: cameraEnabled
                    ? 'var(--color-success-default)'
                    : 'var(--color-surface-raised)',
                }}
                onMouseEnter={(e) => {
                  if (!cameraEnabled) e.currentTarget.style.background = 'var(--color-surface-overlay)';
                }}
                onMouseLeave={(e) => {
                  if (!cameraEnabled) e.currentTarget.style.background = 'var(--color-surface-raised)';
                }}
                aria-label={cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
            </Tooltip>

            {/* Screen Share */}
            <ScreenShareButton />

            {/* Disconnect */}
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
