'use client';

import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';

interface LinkPreviewProps {
  content: string;
}

const URL_REGEX = /https?:\/\/[^\s<]+/g;

export function LinkPreview({ content }: LinkPreviewProps) {
  const urls = useMemo(() => {
    const matches = content.match(URL_REGEX);
    if (!matches) return [];
    // Deduplicate
    return [...new Set(matches)].slice(0, 3);
  }, [content]);

  if (urls.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {urls.map((url) => (
        <LinkCard key={url} url={url} />
      ))}
    </div>
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
