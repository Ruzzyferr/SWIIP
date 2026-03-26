'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn, stringToColor, getInitials } from '@/lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline' | 'invisible' | null;

const sizeMap: Record<AvatarSize, number> = {
  xs: 16,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
  '2xl': 80,
};

const statusDotSizeMap: Record<AvatarSize, number> = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  '2xl': 18,
};

const statusColorMap: Record<NonNullable<PresenceStatus>, string> = {
  online: 'var(--color-status-online)',
  idle: 'var(--color-status-idle)',
  dnd: 'var(--color-status-dnd)',
  offline: 'var(--color-status-offline)',
  invisible: 'var(--color-status-offline)',
};

interface AvatarProps {
  src?: string | null;
  alt?: string;
  userId?: string;
  displayName?: string;
  size?: AvatarSize;
  status?: PresenceStatus;
  className?: string;
  loading?: boolean;
}

export function Avatar({
  src,
  alt,
  userId,
  displayName,
  size = 'md',
  status,
  className,
  loading = false,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const px = sizeMap[size];
  const dotPx = statusDotSizeMap[size];

  const fallbackColor = userId
    ? stringToColor(userId)
    : displayName
    ? stringToColor(displayName)
    : '#6366f1';

  const initials = displayName ? getInitials(displayName) : '?';
  const showImage = src && !imgError;

  const fontSize = px < 24 ? 8 : px < 32 ? 10 : px < 48 ? 12 : px < 64 ? 16 : 24;

  if (loading) {
    return (
      <div
        className={cn('relative flex-shrink-0 rounded-full animate-pulse', className)}
        style={{ width: px, height: px, background: 'var(--color-surface-raised)' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={cn('relative flex-shrink-0', className)}
      style={{ width: px, height: px }}
    >
      {/* Avatar image or fallback */}
      <div
        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center select-none"
        style={
          showImage
            ? undefined
            : { background: fallbackColor }
        }
      >
        {showImage ? (
          <Image
            src={src}
            alt={alt ?? displayName ?? 'Avatar'}
            width={px}
            height={px}
            className="object-cover w-full h-full"
            onError={() => setImgError(true)}
          />
        ) : (
          <span
            className="font-semibold text-white leading-none"
            style={{ fontSize }}
            aria-label={displayName}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Presence status dot */}
      {status && (
        <div
          className="absolute bottom-0 right-0 rounded-full"
          style={{
            width: dotPx,
            height: dotPx,
            background: statusColorMap[status],
            border: `2px solid var(--color-surface-elevated)`,
            // Ensure dot is fully outside the circle using translate
            transform: 'translate(1px, 1px)',
          }}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}
