'use client';

import { useEffect, useRef, useState, memo } from 'react';
import { Mic, MicOff, Monitor, Pin, PinOff } from 'lucide-react';

interface VideoTileProps {
  participantId: string;
  displayName: string;
  avatarUrl?: string;
  track?: MediaStreamTrack;
  isScreen?: boolean;
  isMuted?: boolean;
  isSpeaking?: boolean;
  isPinned?: boolean;
  onPin?: () => void;
  /** Compact mode for grid layout */
  compact?: boolean;
}

/**
 * Renders a single video tile with the participant's video/screen share.
 * Falls back to avatar display when no video track is available.
 */
export const VideoTile = memo(function VideoTile({
  participantId,
  displayName,
  avatarUrl,
  track,
  isScreen = false,
  isMuted = false,
  isSpeaking = false,
  isPinned = false,
  onPin,
  compact = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (!track) {
      el.srcObject = null;
      setIsPlaying(false);
      return;
    }

    const stream = new MediaStream([track]);
    el.srcObject = stream;
    el.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));

    const handleEnded = () => setIsPlaying(false);
    track.addEventListener('ended', handleEnded);

    return () => {
      track.removeEventListener('ended', handleEnded);
      el.srcObject = null;
      setIsPlaying(false);
    };
  }, [track]);

  return (
    <div
      className="relative rounded-xl overflow-hidden group"
      style={{
        background: 'var(--color-surface-raised)',
        aspectRatio: '16/9',
        border: isSpeaking
          ? '2px solid var(--color-success-default)'
          : '2px solid transparent',
        transition: 'border-color 0.1s ease',
      }}
    >
      {/* Video element — always mounted, visibility toggled */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full"
        style={{
          objectFit: isScreen ? 'contain' : 'cover',
          transform: isScreen ? 'none' : 'scaleX(-1)',
          display: isPlaying ? 'block' : 'none',
          background: isScreen ? '#000' : undefined,
        }}
      />

      {/* Avatar fallback when no video playing */}
      {!isPlaying && (
        <div className="w-full h-full flex items-center justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="rounded-full"
              style={{
                width: compact ? 48 : 80,
                height: compact ? 48 : 80,
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              className="rounded-full flex items-center justify-center text-white font-bold"
              style={{
                width: compact ? 48 : 80,
                height: compact ? 48 : 80,
                background: 'var(--color-accent-primary)',
                fontSize: compact ? 18 : 28,
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Bottom bar: name + mute indicator */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 py-1"
        style={{
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
        }}
      >
        {isScreen && (
          <Monitor size={compact ? 12 : 14} className="text-red-400 shrink-0" />
        )}
        <span
          className="text-white text-xs font-medium truncate flex-1"
          style={{ fontSize: compact ? 11 : 12 }}
        >
          {isScreen ? `${displayName}'s screen` : displayName}
        </span>
        {!isScreen && (
          isMuted ? (
            <MicOff size={compact ? 12 : 14} className="text-red-400 shrink-0" />
          ) : (
            <Mic
              size={compact ? 12 : 14}
              className="shrink-0"
              style={{ color: isSpeaking ? 'var(--color-success-default)' : 'rgba(255,255,255,0.6)' }}
            />
          )
        )}
      </div>

      {/* Pin button (visible on hover) */}
      {onPin && (
        <button
          onClick={onPin}
          className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: isPinned ? 'var(--color-accent-primary)' : 'rgba(0,0,0,0.5)',
          }}
          title={isPinned ? 'Unpin' : 'Pin'}
        >
          {isPinned ? (
            <PinOff size={14} className="text-white" />
          ) : (
            <Pin size={14} className="text-white" />
          )}
        </button>
      )}
    </div>
  );
});
