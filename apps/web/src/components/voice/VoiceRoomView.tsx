'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
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
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu';
import { VideoTile } from './VideoTile';
import { ScreenShareModal } from './ScreenShareModal';
import { useVoiceStore, type VoiceParticipant, type ScreenShareQuality } from '@/stores/voice.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useAuthStore } from '@/stores/auth.store';
import { useVoiceActions } from '@/hooks/useVoiceActions';
import { useLiveKitContext } from '@/contexts/LiveKitContext';
import { updateMember } from '@/lib/api/guilds.api';

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const tileVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 30, mass: 0.8 },
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
};

const spotlightVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.2 },
  },
};

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
        max={100}
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
// Participant Tile (audio-only — shows avatar, mute/deaf badges, speaking ring)
// ---------------------------------------------------------------------------

function ParticipantTile({
  participant,
  guildId,
  isCurrentUser,
  size = 'normal',
}: {
  participant: VoiceParticipant;
  guildId: string;
  isCurrentUser: boolean;
  size?: 'normal' | 'compact';
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

  const isCompact = size === 'compact';

  const handleServerMute = useCallback(async () => {
    try {
      await updateMember(guildId, participant.userId, { mute: !participant.serverMute });
    } catch (err) {
      console.error('Server mute failed:', err);
    }
  }, [guildId, participant.userId, participant.serverMute]);

  const handleServerDeafen = useCallback(async () => {
    try {
      await updateMember(guildId, participant.userId, { deaf: !participant.serverDeaf });
    } catch (err) {
      console.error('Server deafen failed:', err);
    }
  }, [guildId, participant.userId, participant.serverDeaf]);

  const contextItems: ContextMenuItem[] = isCurrentUser
    ? []
    : [
        { type: 'label', label: displayName },
        { type: 'separator' },
        {
          type: 'custom',
          customContent: <UserVolumeSlider userId={participant.userId} />,
        },
        { type: 'separator' },
        {
          type: 'item',
          label: participant.serverMute ? 'Unmute Member' : 'Server Mute',
          icon: participant.serverMute ? <Mic size={14} /> : <MicOff size={14} />,
          danger: !participant.serverMute,
          onClick: handleServerMute,
        },
        {
          type: 'item',
          label: participant.serverDeaf ? 'Undeafen Member' : 'Server Deafen',
          icon: participant.serverDeaf ? <Headphones size={14} /> : <EarOff size={14} />,
          danger: !participant.serverDeaf,
          onClick: handleServerDeafen,
        },
      ];

  const tile = (
    <motion.div
      layout
      layoutId={`participant-${participant.userId}`}
      variants={tileVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col items-center justify-center rounded-xl"
      style={{
        background: 'var(--color-surface-raised)',
        border: `2px solid ${borderColor}`,
        transition: 'border-color 0.1s',
        padding: isCompact ? '12px 8px' : '24px 16px',
        gap: isCompact ? 6 : 10,
        minWidth: isCompact ? 80 : 0,
        aspectRatio: isCompact ? undefined : '1 / 1',
      }}
    >
      {/* Avatar with speaking ring */}
      <div className="relative">
        <motion.div
          className="rounded-full"
          animate={{
            boxShadow: isSpeaking
              ? '0 0 0 3px var(--color-voice-speaking), 0 0 16px var(--color-voice-speaking)'
              : '0 0 0 0px transparent, 0 0 0px transparent',
          }}
          transition={{ duration: 0.15 }}
        >
          <Avatar
            src={member?.user?.avatar ?? (member?.user as { avatarId?: string } | undefined)?.avatarId}
            userId={participant.userId}
            displayName={displayName}
            size={isCompact ? 'md' : 'xl'}
          />
        </motion.div>

        {/* Mute/Deaf indicator badge */}
        {(participant.selfMute || participant.selfDeaf) && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center"
            style={{
              width: isCompact ? 18 : 24,
              height: isCompact ? 18 : 24,
              background: 'var(--color-surface-overlay)',
              border: '2px solid var(--color-surface-raised)',
            }}
          >
            {participant.selfDeaf ? (
              <EarOff size={isCompact ? 9 : 12} style={{ color: 'var(--color-danger-default)' }} />
            ) : (
              <MicOff size={isCompact ? 9 : 12} style={{ color: 'var(--color-danger-default)' }} />
            )}
          </motion.div>
        )}

        {/* Video indicator badge */}
        {participant.selfVideo && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -bottom-1 -left-1 rounded-full flex items-center justify-center"
            style={{
              width: isCompact ? 18 : 24,
              height: isCompact ? 18 : 24,
              background: 'var(--color-surface-overlay)',
              border: '2px solid var(--color-surface-raised)',
            }}
          >
            <Video size={isCompact ? 9 : 12} style={{ color: 'var(--color-success-default)' }} />
          </motion.div>
        )}
      </div>

      {/* Name */}
      <span
        className="font-medium truncate w-full text-center"
        style={{
          fontSize: isCompact ? 11 : 13,
          color: isSpeaking
            ? 'var(--color-voice-speaking)'
            : 'var(--color-text-primary)',
          transition: 'color 0.15s',
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
// Adaptive grid layout calculator (Discord-style)
// ---------------------------------------------------------------------------

function getGridLayout(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: Math.ceil(count / 4) };
}

// ---------------------------------------------------------------------------
// Voice Room Content — handles layout switching
// ---------------------------------------------------------------------------

function VoiceRoomContent({
  participants,
  guildId,
  userId,
}: {
  participants: VoiceParticipant[];
  guildId: string;
  userId: string | undefined;
}) {
  const { videoTracks } = useLiveKitContext();
  const pinnedId = useVoiceStore((s) => s.pinnedParticipantId);
  const setPinnedParticipant = useVoiceStore((s) => s.setPinnedParticipant);
  const members = useGuildsStore((s) => s.members[guildId]);

  // Classify what's happening
  const screenSharers = useMemo(() => {
    return participants.filter(
      (p) => p.screenSharing || videoTracks[p.userId]?.screen,
    );
  }, [participants, videoTracks]);

  const hasAnyVideo = useMemo(() => {
    return participants.some(
      (p) =>
        p.selfVideo ||
        p.screenSharing ||
        videoTracks[p.userId]?.camera ||
        videoTracks[p.userId]?.screen,
    );
  }, [participants, videoTracks]);

  // Determine if we have a pinned screen share for spotlight
  const pinnedScreenSharer = useMemo(() => {
    if (!pinnedId) return screenSharers[0] ?? null;
    return screenSharers.find((s) => s.userId === pinnedId) ?? screenSharers[0] ?? null;
  }, [screenSharers, pinnedId]);

  if (participants.length === 0) return null;

  // ── SPOTLIGHT MODE: Someone is screen sharing ──
  if (screenSharers.length > 0) {
    // Calculate screen share grid layout
    const screenGridCols = screenSharers.length === 1 ? 1 : 2;

    return (
      <LayoutGroup>
        <div className="flex-1 flex flex-col gap-3 w-full max-w-6xl min-h-0">
          {/* Screen share area — single spotlight or grid */}
          <div
            className="flex-1 min-h-0 grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${screenGridCols}, 1fr)`,
              alignContent: 'center',
            }}
          >
            <AnimatePresence mode="popLayout">
              {screenSharers.map((sharer) => {
                const screenTrack = videoTracks[sharer.userId]?.screen;
                const sharerMember = members?.[sharer.userId];
                const sharerName =
                  sharerMember?.nick ??
                  sharerMember?.user?.globalName ??
                  sharerMember?.user?.username ??
                  sharer.userId;
                const isThisPinned = pinnedScreenSharer?.userId === sharer.userId;

                return (
                  <motion.div
                    key={`screen-${sharer.userId}`}
                    variants={spotlightVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="min-h-0"
                  >
                    <VideoTile
                      participantId={sharer.userId}
                      displayName={sharerName}
                      avatarUrl={
                        sharerMember?.user?.avatar ??
                        (sharerMember?.user as { avatarId?: string } | undefined)?.avatarId
                      }
                      track={screenTrack}
                      isScreen
                      isMuted={sharer.selfMute}
                      isSpeaking={sharer.speaking && !sharer.selfMute}
                      isPinned={isThisPinned}
                      onPin={() => setPinnedParticipant(sharer.userId)}
                      viewerCount={participants.length - 1}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Bottom strip: All participants (including sharers' cameras) */}
          <div className="flex gap-2 overflow-x-auto pb-1 justify-center shrink-0">
            <AnimatePresence mode="popLayout">
              {participants.map((p) => {
                const tracks = videoTracks[p.userId];
                const hasCameraTrack = !!tracks?.camera;

                if (hasCameraTrack) {
                  const member = members?.[p.userId];
                  const name =
                    member?.nick ??
                    member?.user?.globalName ??
                    member?.user?.username ??
                    p.userId;
                  return (
                    <motion.div
                      key={p.userId}
                      layout
                      variants={tileVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      style={{ width: 200, flexShrink: 0 }}
                    >
                      <VideoTile
                        participantId={p.userId}
                        displayName={name + (p.userId === userId ? ' (you)' : '')}
                        avatarUrl={
                          member?.user?.avatar ??
                          (member?.user as { avatarId?: string } | undefined)?.avatarId
                        }
                        track={tracks?.camera}
                        isMuted={p.selfMute}
                        isSpeaking={p.speaking && !p.selfMute}
                        compact
                        onPin={() => setPinnedParticipant(p.userId)}
                      />
                    </motion.div>
                  );
                }

                return (
                  <ParticipantTile
                    key={p.userId}
                    participant={p}
                    guildId={guildId}
                    isCurrentUser={p.userId === userId}
                    size="compact"
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </LayoutGroup>
    );
  }

  // ── VIDEO GRID MODE: Cameras active, no screen share ──
  if (hasAnyVideo) {
    const videoParticipants = participants.filter(
      (p) => p.selfVideo || videoTracks[p.userId]?.camera,
    );
    const audioOnlyParticipants = participants.filter(
      (p) => !p.selfVideo && !videoTracks[p.userId]?.camera,
    );

    const { cols } = getGridLayout(videoParticipants.length);

    return (
      <LayoutGroup>
        <div className="flex-1 flex flex-col gap-3 w-full max-w-5xl min-h-0">
          {/* Video grid */}
          <div
            className="flex-1 flex flex-wrap gap-3 min-h-0 justify-center items-center content-center"
          >
            <AnimatePresence mode="popLayout">
              {videoParticipants.map((p) => {
                const member = members?.[p.userId];
                const name =
                  member?.nick ??
                  member?.user?.globalName ??
                  member?.user?.username ??
                  p.userId;
                const tracks = videoTracks[p.userId];

                return (
                  <motion.div
                    key={p.userId}
                    layout
                    variants={tileVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    style={{
                      width: `calc(${100 / cols}% - ${((cols - 1) * 12) / cols}px)`,
                      aspectRatio: '16 / 9',
                    }}
                  >
                    <VideoTile
                      participantId={p.userId}
                      displayName={name + (p.userId === userId ? ' (you)' : '')}
                      avatarUrl={
                        member?.user?.avatar ??
                        (member?.user as { avatarId?: string } | undefined)?.avatarId
                      }
                      track={tracks?.camera}
                      isMuted={p.selfMute}
                      isSpeaking={p.speaking && !p.selfMute}
                      onPin={() => setPinnedParticipant(p.userId)}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Audio-only participants below the video grid */}
          {audioOnlyParticipants.length > 0 && (
            <div className="flex gap-2 justify-center shrink-0 pb-1">
              <AnimatePresence mode="popLayout">
                {audioOnlyParticipants.map((p) => (
                  <ParticipantTile
                    key={p.userId}
                    participant={p}
                    guildId={guildId}
                    isCurrentUser={p.userId === userId}
                    size="compact"
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </LayoutGroup>
    );
  }

  // ── AUDIO-ONLY MODE: No video, just avatars in a flex grid ──
  const { cols } = getGridLayout(participants.length);
  const tileWidth = 180;

  return (
    <LayoutGroup>
      <div
        className="flex flex-wrap gap-4 justify-center"
        style={{
          maxWidth: cols * (tileWidth + 16),
          width: '100%',
        }}
      >
        <AnimatePresence mode="popLayout">
          {participants.map((p) => (
            <div key={p.userId} style={{ width: tileWidth, flexShrink: 0 }}>
              <ParticipantTile
                participant={p}
                guildId={guildId}
                isCurrentUser={p.userId === userId}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}

// ---------------------------------------------------------------------------
// Screen Share Button
// ---------------------------------------------------------------------------

function ScreenShareButton() {
  const screenShareEnabled = useVoiceStore((s) => s.screenShareEnabled);
  const { toggleScreenShare } = useVoiceActions();
  const [modalOpen, setModalOpen] = useState(false);

  const btnClass =
    'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200';

  const handleClick = () => {
    if (screenShareEnabled) {
      toggleScreenShare();
    } else {
      setModalOpen(true);
    }
  };

  const handleStart = (quality: ScreenShareQuality, audio: boolean) => {
    toggleScreenShare(quality, audio);
  };

  return (
    <>
      <Tooltip content={screenShareEnabled ? 'Stop Sharing' : 'Share Screen'} placement="top">
        <button
          onClick={handleClick}
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
      <ScreenShareModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onStart={handleStart}
      />
    </>
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

  const btnClass =
    'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200';

  return (
    <div
      className="flex-1 flex flex-col items-center gap-4 p-4 sm:p-6 overflow-y-auto overflow-x-hidden"
      style={{ background: 'var(--color-surface-base)' }}
    >
      {/* Channel header */}
      <div className="text-center shrink-0">
        <h2
          className="text-lg font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {channel?.name ?? 'Voice Channel'}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
          {participants.length} participant{participants.length !== 1 ? 's' : ''}
          {channel?.userLimit ? ` / ${channel.userLimit}` : ''}
        </p>
      </div>

      {/* Status messages */}
      <AnimatePresence>
        {isConnecting && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 shrink-0"
            style={{ color: 'var(--color-status-idle)' }}
          >
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">
              {connectionState === 'reconnecting' ? 'Reconnecting...' : 'Connecting...'}
            </span>
          </motion.div>
        )}

        {hasError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg shrink-0"
            style={{
              background: 'var(--color-danger-muted)',
              color: 'var(--color-danger-default)',
            }}
          >
            <AlertTriangle size={16} />
            <span className="text-sm">{error ?? 'Failed to connect to voice channel'}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area — grows but shrinks to keep controls visible */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0 overflow-hidden shrink">
        {participants.length > 0 ? (
          <VoiceRoomContent
            participants={participants}
            guildId={guildId}
            userId={userId}
          />
        ) : !isInThisChannel ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-3"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
              style={{ background: 'var(--color-surface-raised)' }}
            >
              <Phone size={28} style={{ color: 'var(--color-text-tertiary)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              No one is in this voice channel.
            </p>
          </motion.div>
        ) : null}
      </div>

      {/* Controls bar — always at bottom, never hidden */}
      <motion.div
        className="flex items-center gap-3 shrink-0 pb-2 sm:pb-0"
        layout
      >
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
      </motion.div>
    </div>
  );
}
