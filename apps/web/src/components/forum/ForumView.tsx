'use client';

import { useState } from 'react';
import { Plus, MessageSquare, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@/components/ui/Avatar';

interface ForumPost {
  id: string;
  title: string;
  author: { id: string; username: string; globalName?: string; avatar?: string };
  replyCount: number;
  createdAt: string;
}

interface ForumViewProps {
  channelId: string;
  channelName: string;
}

export function ForumView({ channelId, channelName }: ForumViewProps) {
  const [posts] = useState<ForumPost[]>([]);

  return (
    <div className="flex-1 flex flex-col min-h-0 p-6" style={{ background: 'var(--color-surface-base)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          # {channelName}
        </h2>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--color-accent-primary)', color: '#fff' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-accent-primary)'; }}
        >
          <Plus size={16} />
          New Post
        </button>
      </div>

      {/* Posts grid */}
      {posts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-disabled)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              No posts yet
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              Be the first to start a discussion!
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 overflow-y-auto scroll-thin" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-xl p-4 cursor-pointer transition-colors"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-subtle)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}
            >
              <h3 className="text-sm font-semibold mb-2 line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>
                {post.title}
              </h3>
              <div className="flex items-center gap-2">
                <Avatar userId={post.author.id} src={post.author.avatar} displayName={post.author.globalName ?? post.author.username} size="xs" />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {post.author.globalName ?? post.author.username}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                <span className="flex items-center gap-1">
                  <MessageSquare size={12} /> {post.replyCount}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
