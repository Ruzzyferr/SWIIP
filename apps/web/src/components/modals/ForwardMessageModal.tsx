'use client';

import { useState, useMemo } from 'react';
import { Search, Send, Hash, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useUIStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useDMsStore } from '@/stores/dms.store';
import { useAuthStore } from '@/stores/auth.store';
import { sendMessage } from '@/lib/api/messages.api';
import { toastError, toastSuccess } from '@/lib/toast';
import { ChannelType } from '@constchat/protocol';

export function ForwardMessageModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const modalData = useUIStore((s) => s.activeModal?.props) as { content: string; authorName: string } | undefined;
  const guilds = useGuildsStore((s) => s.guilds);
  const channels = useGuildsStore((s) => s.channels);
  const conversations = useDMsStore((s) => s.conversations);
  const currentUser = useAuthStore((s) => s.user);

  const [search, setSearch] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  const content = modalData?.content ?? '';
  const authorName = modalData?.authorName ?? 'Unknown';

  // Build list of targets: DMs + text channels
  const targets = useMemo(() => {
    const list: Array<{ id: string; name: string; type: 'dm' | 'channel'; icon: 'dm' | 'group' | 'channel'; guildName?: string }> = [];

    // DM conversations
    for (const dm of Object.values(conversations)) {
      const otherUser = dm.recipients?.find((r) => r.id !== currentUser?.id) ?? dm.recipients?.[0];
      const isGroup = dm.type === ChannelType.GROUP_DM;
      list.push({
        id: dm.id,
        name: isGroup
          ? (dm.name ?? dm.recipients?.map((r) => r.globalName ?? r.username).join(', ') ?? 'Group')
          : (otherUser?.globalName ?? otherUser?.username ?? 'Unknown'),
        type: 'dm',
        icon: isGroup ? 'group' : 'dm',
      });
    }

    // Guild text channels
    for (const guild of Object.values(guilds)) {
      const guildChannels = Object.values(channels).filter(
        (c: any) => c.guildId === guild.id && (c.type === 'TEXT' || c.type === 0)
      );
      for (const ch of guildChannels) {
        list.push({
          id: ch.id,
          name: ch.name,
          type: 'channel',
          icon: 'channel',
          guildName: guild.name,
        });
      }
    }

    return list;
  }, [conversations, guilds, channels, currentUser?.id]);

  const filtered = useMemo(() => {
    if (!search) return targets;
    const q = search.toLowerCase();
    return targets.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      (t.guildName?.toLowerCase().includes(q) ?? false)
    );
  }, [targets, search]);

  const handleForward = async (targetId: string) => {
    setSending(targetId);
    try {
      const forwardedContent = `> **${authorName}:** ${content.split('\n').join('\n> ')}\n\n`;
      await sendMessage(targetId, { content: forwardedContent });
      toastSuccess('Message forwarded');
      closeModal();
    } catch {
      toastError('Failed to forward message');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Forward Message
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
          Select a channel or conversation to forward to
        </p>
      </div>

      {/* Preview */}
      <div
        className="rounded-lg p-3 text-xs"
        style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)' }}
      >
        <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{authorName}: </span>
        {content.length > 120 ? content.slice(0, 120) + '...' : content}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--color-text-tertiary)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search channels and DMs..."
          autoFocus
          className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
          style={{
            background: 'var(--color-surface-base)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-default)',
          }}
        />
      </div>

      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {filtered.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
            No results found
          </p>
        ) : (
          filtered.map((target) => (
            <button
              key={target.id}
              onClick={() => handleForward(target.id)}
              disabled={sending === target.id}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {target.icon === 'channel' ? (
                <Hash size={18} style={{ color: 'var(--color-text-tertiary)' }} />
              ) : target.icon === 'group' ? (
                <Users size={18} style={{ color: 'var(--color-text-tertiary)' }} />
              ) : (
                <Avatar displayName={target.name} size="sm" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">{target.name}</span>
                {target.guildName && (
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{target.guildName}</span>
                )}
              </div>
              {sending === target.id ? (
                <div className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-text-disabled)', borderTopColor: 'var(--color-accent-primary)' }} />
              ) : (
                <Send size={14} style={{ color: 'var(--color-text-tertiary)' }} />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
