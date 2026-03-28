'use client';

import { useMemo } from 'react';
import { ExternalLink, Play } from 'lucide-react';

interface LinkPreviewProps {
  content: string;
}

const URL_REGEX = /https?:\/\/[^\s<]+/g;

// YouTube URL patterns
const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;

function getYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match?.[1] ?? null;
}

export function LinkPreview({ content }: LinkPreviewProps) {
  const urls = useMemo(() => {
    const matches = content.match(URL_REGEX);
    if (!matches) return [];
    return [...new Set(matches)].slice(0, 3);
  }, [content]);

  if (urls.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {urls.map((url) => {
        const ytId = getYouTubeId(url);
        if (ytId) return <YouTubeCard key={url} url={url} videoId={ytId} />;
        return <LinkCard key={url} url={url} />;
      })}
    </div>
  );
}

function YouTubeCard({ url, videoId }: { url: string; videoId: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg overflow-hidden max-w-md transition-opacity hover:opacity-90"
      style={{
        background: 'var(--color-surface-raised)',
        borderLeft: '3px solid #ff0000',
      }}
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
          alt="YouTube video thumbnail"
          className="w-full object-cover"
          style={{ maxHeight: '200px' }}
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
          >
            <Play size={20} className="text-white ml-0.5" fill="white" />
          </div>
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          YouTube
        </p>
        <p className="text-sm truncate mt-0.5" style={{ color: 'var(--color-text-accent)' }}>
          {url}
        </p>
      </div>
    </a>
  );
}

function LinkCard({ url }: { url: string }) {
  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch {
    return null;
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors max-w-md"
      style={{
        background: 'var(--color-surface-raised)',
        borderLeft: '3px solid var(--color-accent-primary)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-overlay)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={faviconUrl}
        alt=""
        className="w-4 h-4 rounded-sm flex-shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {domain}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
          {url}
        </p>
      </div>
      <ExternalLink size={12} className="flex-shrink-0" style={{ color: 'var(--color-text-disabled)' }} />
    </a>
  );
}
