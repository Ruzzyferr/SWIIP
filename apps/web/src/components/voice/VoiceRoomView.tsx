'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Eye,
  EyeOff,
  UserPlus,
  MessageCircle,
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
import { useUIStore } from '@/stores/ui.store';
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
// Per-stream volume slider (independent from user mic volume)
// ---------------------------------------------------------------------------

function StreamVolumeSlider({ userId }: { userId: string }) {
  const volume = useVoiceStore((s) => s.streamVolumes[userId] ?? 100);
  const setStreamVolume = useVoiceStore((s) => s.setStreamVolume);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setStreamVolume(userId, Number(e.target.value));
    },
    [userId, setStreamVolume],
  );

  return (
    <div className="flex flex-col gap-1.5 min-w-[160px]">
      <div className="flex items-center gap-2">
        <Monitor size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Stream Volume
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
      className="flex flex-col items-center justify-center"
      style={{
        background: 'var(--color-surface-raised)',
        borderRadius: 12,
        padding: isCompact ? 12 : 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isCompact ? 6 : 8,
        border: isSpeaking
          ? '2px solid var(--color-accent-primary)'
          : '2px solid var(--color-border-subtle)',
        boxShadow: isSpeaking ? '0 0 20px rgba(16, 185, 129, 0.25)' : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
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

        {/* Screen sharing LIVE badge */}
        {participant.screenSharing && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 rounded flex items-center justify-center"
            style={{
              padding: '1px 4px',
              background: 'var(--color-danger-default)',
              fontSize: isCompact ? 8 : 9,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.2,
              letterSpacing: '0.05em',
            }}
          >
            LIVE
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
// Adaptive grid layout calculator (adaptive tile layout)
// ---------------------------------------------------------------------------

function getGridLayout(count: number, narrow: boolean): { cols: number; rows: number } {
  if (narrow) {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count <= 2) return { cols: 2, rows: 1 };
    return { cols: 2, rows: Math.ceil(count / 2) };
  }
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  if (count <= 16) return { cols: 4, rows: Math.ceil(count / 4) };
  return { cols: 5, rows: Math.ceil(count / 5) };
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

  const watchingStreams = useVoiceStore((s) => s.watchingStreams);
  const setWatchingStream = useVoiceStore((s) => s.setWatchingStream);

  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (participants.length === 0) return null;

  // ── SPOTLIGHT MODE: Someone is screen sharing ──
  if (screenSharers.length > 0) {
    // Split into watched and unwatched streams
    const watchedSharers = screenSharers.filter((s) => watchingStreams[s.userId] !== false);
    const unwatchedSharers = screenSharers.filter((s) => watchingStreams[s.userId] === false);

    // Calculate screen share grid layout — supports any number of sharers
    const screenGridCols = narrow
      ? 1
      : watchedSharers.length <= 1
        ? 1
        : watchedSharers.length <= 4
          ? 2
          : 3;

    return (
      <LayoutGroup>
        <div className="flex-1 flex flex-col gap-3 w-full max-w-6xl min-h-0 mx-auto px-1 sm:px-2">
          {/* Screen share area — single spotlight or grid */}
          {watchedSharers.length > 0 && (
          <div
            className="flex-1 min-h-0 grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${screenGridCols}, 1fr)`,
              alignContent: 'center',
            }}
          >
            <AnimatePresence mode="popLayout">
              {watchedSharers.map((sharer) => {
                const screenTrack = videoTracks[sharer.userId]?.screen;
                const sharerMember = members?.[sharer.userId];
                const sharerName =
                  sharerMember?.nick ??
                  sharerMember?.user?.globalName ??
                  sharerMember?.user?.username ??
                  sharer.userId;
                const isThisPinned = pinnedScreenSharer?.userId === sharer.userId;
                const watcherCount = participants.filter(
                  (p) => p.userId !== sharer.userId && watchingStreams[p.userId] !== false,
                ).length;

                const streamContextItems: ContextMenuItem[] = sharer.userId === userId
                  ? []
                  : [
                      { type: 'label', label: `${sharerName}'s Stream` },
                      { type: 'separator' },
                      {
                        type: 'custom',
                        customContent: <StreamVolumeSlider userId={sharer.userId} />,
                      },
                      { type: 'separator' },
                      {
                        type: 'item',
                        label: 'Stop Watching',
                        icon: <EyeOff size={14} />,
                        danger: true,
                        onClick: () => setWatchingStream(sharer.userId, false),
                      },
                    ];

                const streamTile = (
                  <motion.div
                    key={`screen-${sharer.userId}`}
                    variants={spotlightVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="min-h-0 relative"
                  >
                    {/* LIVE badge + viewer count */}
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--color-danger-default)', color: '#fff' }}
                      >
                        LIVE
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                      >
                        <Eye size={10} />
                        {watcherCount}
                      </span>
                    </div>
                    {sharer.userId !== userId && (
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                        <Tooltip content="Stop Watching" placement="bottom">
                          <button
                            onClick={() => setWatchingStream(sharer.userId, false)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{
                              background: 'rgba(0,0,0,0.6)',
                              color: '#fff',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(237,66,69,0.8)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}
                          >
                            <EyeOff size={14} />
                          </button>
                        </Tooltip>
                      </div>
                    )}
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
                      viewerCount={watcherCount}
                    />
                  </motion.div>
                );

                if (sharer.userId === userId) return streamTile;
                return (
                  <ContextMenu key={`screen-${sharer.userId}`} items={streamContextItems}>
                    {streamTile}
                  </ContextMenu>
                );
              })}
            </AnimatePresence>
          </div>
          )}

          {/* Bottom strip: All participants + unwatched stream tiles */}
          <div className="flex gap-2 overflow-x-auto pb-1 justify-center shrink-0">
            <AnimatePresence mode="popLayout">
              {/* Unwatched stream preview tiles */}
              {unwatchedSharers.map((sharer) => {
                const sharerMember = members?.[sharer.userId];
                const sharerName =
                  sharerMember?.nick ??
                  sharerMember?.user?.globalName ??
                  sharerMember?.user?.username ??
                  sharer.userId;
                return (
                  <motion.div
                    key={`unwatched-${sharer.userId}`}
                    layout
                    variants={tileVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex flex-col items-center justify-center cursor-pointer group"
                    style={{
                      background: 'var(--color-surface-raised)',
                      borderRadius: 12,
                      padding: 12,
                      gap: 6,
                      border: '2px solid var(--color-danger-default)',
                      minWidth: narrow ? 120 : 140,
                      flexShrink: 0,
                    }}
                    onClick={() => setWatchingStream(sharer.userId, true)}
                  >
                    <div className="relative">
                      <Avatar
                        src={sharerMember?.user?.avatar ?? (sharerMember?.user as { avatarId?: string } | undefined)?.avatarId}
                        userId={sharer.userId}
                        displayName={sharerName}
                        size="md"
                      />
                      <div
                        className="absolute -top-1 -right-1 rounded flex items-center justify-center"
                        style={{
                          padding: '1px 4px',
                          background: 'var(--color-danger-default)',
                          fontSize: 8,
                          fontWeight: 700,
                          color: '#fff',
                          lineHeight: 1.2,
                          letterSpacing: '0.05em',
                        }}
                      >
                        LIVE
                      </div>
                    </div>
                    <span
                      className="font-medium truncate w-full text-center"
                      style={{ fontSize: 11, color: 'var(--color-text-primary)' }}
                    >
                      {sharerName}
                    </span>
                    <button
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors"
                      style={{
                        background: 'var(--color-accent-primary)',
                        color: '#fff',
                      }}
                    >
                      <Eye size={10} />
                      Watch
                    </button>
                  </motion.div>
                );
              })}

              {/* Participant tiles */}
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
                      style={{ width: narrow ? 148 : 200, flexShrink: 0 }}
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

    const { cols: rawCols } = getGridLayout(videoParticipants.length, narrow);
    const cols = narrow ? 1 : rawCols;

    return (
      <LayoutGroup>
        <div className="flex-1 flex flex-col gap-3 w-full max-w-5xl min-h-0 px-1 sm:px-0 justify-center">
          {/* Video grid */}
          <div
            className="flex-1 flex flex-wrap gap-2 sm:gap-3 min-h-0 justify-center items-center content-center"
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
                    style={
                      narrow
                        ? {
                            width: '100%',
                            maxWidth: 'min(100%, 720px)',
                            aspectRatio: '16 / 9',
                          }
                        : {
                            width: `calc(${100 / cols}% - ${((cols - 1) * 12) / cols}px)`,
                            aspectRatio: '16 / 9',
                          }
                    }
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
  const { cols } = getGridLayout(participants.length, narrow);
  const tileWidth = narrow ? 148 : 180;

  return (
    <LayoutGroup>
      <div
        className="flex-1 flex flex-wrap gap-3 sm:gap-4 justify-center items-center content-center px-2 w-full max-w-4xl mx-auto"
        style={{
          maxWidth: narrow ? '100%' : cols * (tileWidth + 16),
        }}
      >
        <AnimatePresence mode="popLayout">
          {participants.map((p) => (
            <div
              key={p.userId}
              className="min-w-0"
              style={{
                width: narrow ? `calc((100% - ${(cols - 1) * 12}px) / ${cols})` : tileWidth,
                maxWidth: narrow ? 180 : tileWidth,
                flexShrink: 0,
              }}
            >
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

function EmptyRoomInvite() {
  return (
    <div className="flex flex-col items-center gap-3 mt-8">
      <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
        No one else in this room yet.
      </p>
      <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        style={{
          border: '1.5px solid var(--color-accent-primary)',
          color: 'var(--color-accent-primary)',
          background: 'transparent',
        }}>
        <UserPlus size={14} />
        Invite to Join
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen Share Button
// ---------------------------------------------------------------------------

function ScreenShareButton() {
  const screenShareEnabled = useVoiceStore((s) => s.screenShareEnabled);
  const { toggleScreenShare } = useVoiceActions();
  const [modalOpen, setModalOpen] = useState(false);

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
          className="flex items-center justify-center transition-all duration-200"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            color: screenShareEnabled ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
            background: screenShareEnabled
              ? 'var(--color-accent-muted)'
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
  const isVoiceChatOpen = useUIStore((s) => s.isVoiceChatOpen);
  const toggleVoiceChat = useUIStore((s) => s.toggleVoiceChat);
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

  return (
    <div
      className="flex-1 flex flex-col items-center gap-4 overflow-y-auto overflow-x-hidden"
      style={{ background: 'var(--color-surface-base)', position: 'relative', paddingBottom: 80 }}
    >
      {/* Room Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-3 sm:py-4 w-full shrink-0 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {channel?.name || 'Voice Channel'}
          </h2>
          {participants.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: 'var(--color-accent-muted)',
                color: 'var(--color-accent-primary)',
                border: '1px solid var(--color-accent-primary)',
              }}>
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {channel?.userLimit ? (
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] sm:text-xs whitespace-nowrap font-medium"
                style={{
                  color: participants.length >= channel.userLimit
                    ? 'var(--color-danger-default)'
                    : participants.length >= channel.userLimit * 0.8
                      ? 'var(--color-warning-default)'
                      : 'var(--color-text-tertiary)',
                }}
              >
                {participants.length}/{channel.userLimit}
              </span>
              <div
                className="w-16 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--color-bg-tertiary)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (participants.length / channel.userLimit) * 100)}%`,
                    background: participants.length >= channel.userLimit
                      ? 'var(--color-danger-default)'
                      : participants.length >= channel.userLimit * 0.8
                        ? 'var(--color-warning-default)'
                        : 'var(--color-success-default)',
                  }}
                />
              </div>
            </div>
          ) : (
            <span className="text-[11px] sm:text-xs whitespace-nowrap" style={{ color: 'var(--color-text-tertiary)' }}>
              {isInThisChannel ? 'Connected' : `${participants.length} participant${participants.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
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
      <div className="flex-1 flex flex-col items-center w-full min-h-0 overflow-hidden shrink">
        {participants.length > 0 ? (
          <>
            <VoiceRoomContent
              participants={participants}
              guildId={guildId}
              userId={userId}
            />
            {/* Empty state: only self in the room */}
            {participants.length === 1 && participants[0]?.userId === userId && (
              <EmptyRoomInvite />
            )}
          </>
        ) : !isInThisChannel ? (
          <div className="flex-1 flex items-center justify-center w-full">
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
          </div>
        ) : isInThisChannel && participants.length === 0 ? (
          <div className="flex-1 flex items-center justify-center w-full">
            <EmptyRoomInvite />
          </div>
        ) : null}
      </div>

      {/* Floating Control Bar */}
      <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-10 w-[min(100%,calc(100vw-1rem))] max-w-lg flex justify-center px-1">
        {!isInThisChannel ? (
          <div className="flex items-center justify-center px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl w-full sm:w-auto"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--shadow-float)',
            }}>
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
          </div>
        ) : (
          <motion.div
            className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 rounded-2xl w-full sm:w-auto"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--shadow-float)',
            }}
            layout
          >
            {/* Mute */}
            <Tooltip content={selfMuted ? 'Unmute' : 'Mute'} placement="top">
              <button
                onClick={toggleMute}
                className="flex items-center justify-center transition-all duration-200"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  color: selfMuted ? 'var(--color-danger-default)' : 'var(--color-text-secondary)',
                  background: selfMuted
                    ? 'var(--color-danger-muted)'
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
                className="flex items-center justify-center transition-all duration-200"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  color: selfDeafened ? 'var(--color-danger-default)' : 'var(--color-text-secondary)',
                  background: selfDeafened
                    ? 'var(--color-danger-muted)'
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
                className="flex items-center justify-center transition-all duration-200"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  color: cameraEnabled ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  background: cameraEnabled
                    ? 'var(--color-accent-muted)'
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

            {/* Chat Toggle */}
            <Tooltip content={isVoiceChatOpen ? 'Close Chat' : 'Open Chat'} placement="top">
              <button
                onClick={toggleVoiceChat}
                className="flex items-center justify-center transition-all duration-200"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  color: isVoiceChatOpen ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  background: isVoiceChatOpen
                    ? 'var(--color-accent-muted)'
                    : 'var(--color-surface-raised)',
                }}
                onMouseEnter={(e) => {
                  if (!isVoiceChatOpen) e.currentTarget.style.background = 'var(--color-surface-overlay)';
                }}
                onMouseLeave={(e) => {
                  if (!isVoiceChatOpen) e.currentTarget.style.background = 'var(--color-surface-raised)';
                }}
                aria-label={isVoiceChatOpen ? 'Close Chat' : 'Open Chat'}
              >
                <MessageCircle size={20} />
              </button>
            </Tooltip>

            {/* Separator before Leave */}
            <div style={{ width: 1, height: 24, background: 'var(--color-border-default)', margin: '0 4px' }} />

            {/* Disconnect */}
            <Tooltip content="Disconnect" placement="top">
              <button
                onClick={leaveVoiceChannel}
                className="flex items-center gap-2 font-medium text-sm transition-all duration-200"
                style={{
                  paddingLeft: 16,
                  paddingRight: 16,
                  height: 40,
                  borderRadius: 12,
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
                <PhoneOff size={18} />
                Leave
              </button>
            </Tooltip>
          </motion.div>
        )}
      </div>
    </div>
  );
}
