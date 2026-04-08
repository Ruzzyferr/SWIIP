'use client';

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Mic, MicOff, Monitor, Pin, PinOff, Maximize2, Minimize2, PictureInPicture2, Eye } from 'lucide-react';

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
  /** Number of viewers (for screen shares) */
  viewerCount?: number;
}

/**
 * Renders a single video tile with the participant's video/screen share.
 * Falls back to avatar display when no video track is available.
 * Supports fullscreen, PiP, and double-click to fullscreen for screen shares.
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
  viewerCount,
}: VideoTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Lazy video: only attach stream when tile is visible (IntersectionObserver)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry) setIsVisible(entry.isIntersecting); },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Guard against stale or ended tracks, or tile not visible
    if (!track || track.readyState === 'ended' || !isVisible) {
      el.srcObject = null;
      setIsPlaying(false);
      return;
    }

    const stream = new MediaStream([track]);
    el.srcObject = stream;

    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const tryPlay = () => {
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
          // Retry play after a short delay — the track may need time to
          // deliver frames after ICE reconnection or subscription change.
          retryTimer = setTimeout(tryPlay, 1000);
        });
    };

    tryPlay();

    // Track ended permanently — tear down srcObject
    const handleEnded = () => {
      el.srcObject = null;
      setIsPlaying(false);
    };

    // Track temporarily muted (ICE reconnection, network blip).
    // Keep srcObject alive so playback can resume on unmute.
    const handleMute = () => {
      setIsPlaying(false);
    };

    // Track unmuted — data is flowing again, retry playback.
    const handleUnmute = () => {
      // Re-create stream if srcObject was somehow lost
      if (!el.srcObject) {
        el.srcObject = new MediaStream([track]);
      }
      tryPlay();
    };

    track.addEventListener('ended', handleEnded);
    track.addEventListener('mute', handleMute);
    track.addEventListener('unmute', handleUnmute);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      track.removeEventListener('ended', handleEnded);
      track.removeEventListener('mute', handleMute);
      track.removeEventListener('unmute', handleUnmute);
      el.srcObject = null;
      setIsPlaying(false);
    };
  }, [track, isVisible]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement === containerRef.current) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement === el) {
        await document.exitPictureInPicture();
      } else if (el.readyState >= 2) {
        await el.requestPictureInPicture();
      }
    } catch {
      // PiP not supported or denied
    }
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (isScreen) toggleFullscreen();
  }, [isScreen, toggleFullscreen]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl overflow-hidden group"
      style={{
        background: isFullscreen ? '#000' : 'var(--color-surface-raised)',
        aspectRatio: isFullscreen ? undefined : isScreen ? undefined : '16/9',
        width: isFullscreen ? '100%' : isScreen ? '100%' : undefined,
        height: isFullscreen ? '100%' : isScreen ? '100%' : undefined,
        border: isSpeaking
          ? '2px solid var(--color-success-default)'
          : '2px solid transparent',
        borderRadius: isFullscreen ? 0 : undefined,
        transition: 'border-color 0.1s ease',
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Reconnecting overlay for screen shares */}
      {isScreen && !isPlaying && track && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="animate-spin w-6 h-6 border-2 border-current border-t-transparent rounded-full"
            style={{ color: 'var(--color-accent-primary)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Stream reconnecting...
          </span>
        </div>
      )}

      {/* Video element — always mounted, visibility toggled */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full"
        style={{
          objectFit: isScreen || isFullscreen ? 'contain' : 'cover',
          transform: isScreen ? 'none' : 'scaleX(-1)',
          display: isPlaying ? 'block' : 'none',
          background: isScreen || isFullscreen ? '#000' : undefined,
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
          <div className="flex items-center gap-1">
            <Monitor size={compact ? 12 : 14} className="text-red-400 shrink-0" />
            <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-red-500/90 text-white uppercase tracking-wider">
              LIVE
            </span>
          </div>
        )}
        <span
          className="text-white text-xs font-medium truncate flex-1"
          style={{ fontSize: compact ? 11 : 12 }}
        >
          {isScreen ? `${displayName}'s screen` : displayName}
        </span>
        {/* Viewer count for screen shares */}
        {isScreen && viewerCount !== undefined && viewerCount > 0 && (
          <span className="flex items-center gap-0.5 text-white/70 text-xs shrink-0">
            <Eye size={11} />
            {viewerCount}
          </span>
        )}
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

      {/* Top-right action buttons (visible on hover) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Fullscreen button (for screen shares or when video is playing) */}
        {(isScreen || isPlaying) && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            className="p-1.5 rounded-md transition-colors"
            style={{
              background: isFullscreen ? 'var(--color-accent-primary)' : 'rgba(0,0,0,0.6)',
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 size={14} className="text-white" />
            ) : (
              <Maximize2 size={14} className="text-white" />
            )}
          </button>
        )}

        {/* PiP button */}
        {isPlaying && (
          <button
            onClick={(e) => { e.stopPropagation(); togglePiP(); }}
            className="p-1.5 rounded-md transition-colors"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            title="Picture in Picture"
          >
            <PictureInPicture2 size={14} className="text-white" />
          </button>
        )}

        {/* Pin button */}
        {onPin && (
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className="p-1.5 rounded-md transition-colors"
            style={{
              background: isPinned ? 'var(--color-accent-primary)' : 'rgba(0,0,0,0.6)',
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

      {/* Fullscreen exit hint overlay */}
      {isFullscreen && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs text-white/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          Press Esc or double-click to exit fullscreen
        </div>
      )}
    </div>
  );
});
