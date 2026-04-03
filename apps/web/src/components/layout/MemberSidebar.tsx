'use client';

import { useMemo, useState, useCallback, Fragment } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu';
import { MemberContextMenu } from '@/components/menus/MemberContextMenu';
import { useGuildsStore } from '@/stores/guilds.store';
import { usePresenceStore } from '@/stores/presence.store';
import { useAuthStore } from '@/stores/auth.store';
import { useVoiceStore } from '@/stores/voice.store';
import { Wifi, Shield, Zap, Volume2, UserPlus } from 'lucide-react';
import type { MemberPayload, RolePayload } from '@constchat/protocol';

interface MemberSidebarProps {
  guildId: string;
  channelId?: string;
  isVoiceChannel?: boolean;
}

interface ContextMenuState {
  member: MemberPayload;
  position: { x: number; y: number };
}

function MemberItem({
  member,
  onContextMenu,
  nameColor,
}: {
  member: MemberPayload;
  onContextMenu: (e: React.MouseEvent, member: MemberPayload) => void;
  nameColor?: string;
}) {
  const getPresence = usePresenceStore((s) => s.getPresence);
  const userPresence = usePresenceStore((s) => s.users[member.userId]);
  const status = getPresence(member.userId);
  const customStatus = userPresence?.customStatus;
  const displayName = member.nick ?? member.user?.globalName ?? member.user?.username ?? member.userId;

  return (
    <motion.button
      className="flex items-center gap-3 w-full px-2 py-1.5 rounded-lg"
      whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.05)' }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        opacity: status === 'offline' ? 0.4 : 1,
        background: 'transparent',
      }}
      onContextMenu={(e) => onContextMenu(e, member)}
      aria-label={displayName}
    >
      <div className="relative">
        <Avatar
          userId={member.userId}
          src={member.avatar ?? member.user?.avatar ?? (member.user as { avatarId?: string } | undefined)?.avatarId}
          displayName={displayName}
          size="sm"
          status={status}
        />
        {/* Animated online status ring */}
        {status === 'online' && (
          <div
            className="absolute -inset-[2px] rounded-full status-ring-pulse"
            style={{
              border: '1.5px solid var(--color-status-online)',
              opacity: 0.4,
            }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <span
          className="text-sm truncate block"
          style={{ color: nameColor ?? 'var(--color-text-secondary)' }}
        >
          {displayName}
        </span>
        {customStatus && (
          <span
            className="text-xs truncate block"
            style={{ color: 'var(--color-text-disabled)' }}
          >
            {customStatus}
          </span>
        )}
      </div>
    </motion.button>
  );
}

/* ── Voice Context Panel (shown when viewing a voice channel) ── */
function VoiceContextPanel({ channelId, guildId }: { channelId: string; guildId: string }) {
  const participants = useVoiceStore((s) => s.getChannelParticipants(channelId));
  const connectionQuality = useVoiceStore((s) => s.connectionQuality);
  const connectionState = useVoiceStore((s) => s.connectionState);
  const effectiveAudioMode = useVoiceStore((s) => s.effectiveAudioMode);
  const currentChannelId = useVoiceStore((s) => s.currentChannelId);
  const userVolumes = useVoiceStore((s) => s.userVolumes);
  const setUserVolume = useVoiceStore((s) => s.setUserVolume);
  const members = useGuildsStore((s) => s.members[guildId] ?? {});
  const getPresence = usePresenceStore((s) => s.getPresence);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const isConnected = connectionState === 'connected' && currentChannelId === channelId;

  const qualityLabel = connectionQuality >= 3 ? 'Excellent' : connectionQuality >= 2 ? 'Good' : connectionQuality >= 1 ? 'Poor' : 'Lost';
  const qualityColor = connectionQuality >= 3 ? 'var(--color-status-online)' : connectionQuality >= 2 ? 'var(--color-warning-default)' : 'var(--color-danger-default)';

  const modeLabel = effectiveAudioMode === 'enhanced' ? 'Enhanced (RNNoise)' : effectiveAudioMode === 'raw' ? 'Raw (No Processing)' : 'Standard';

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ gap: 0 }}>
      {/* Room Health */}
      {isConnected && (
        <div className="px-4 pt-4 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.1em' }}>
            Room Health
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: 'var(--color-surface-raised)' }}>
              <Wifi size={14} style={{ color: qualityColor }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>Connection</p>
                <p className="text-xs" style={{ color: qualityColor }}>{qualityLabel}</p>
              </div>
              <div className="w-2 h-2 rounded-full" style={{ background: qualityColor }} />
            </div>
          </div>
        </div>
      )}

      {/* Participants */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.1em' }}>
          Participants — {participants.length}
        </p>
        <div className="space-y-1">
          {participants.map((p) => {
            const member = members[p.userId];
            const displayName = member?.nick ?? member?.user?.globalName ?? member?.user?.username ?? p.userId;
            const status = getPresence(p.userId);
            const isSelf = p.userId === currentUserId;
            const contextItems: ContextMenuItem[] = isSelf ? [] : [
              { type: 'label', label: displayName },
              { type: 'separator' },
              {
                type: 'custom',
                customContent: (
                  <div className="px-3 py-1.5">
                    <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-tertiary)' }}>Volume</p>
                    <div className="flex items-center gap-2">
                      <Volume2 size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                      <input
                        type="range" min={0} max={200} step={1}
                        value={userVolumes[p.userId] ?? 100}
                        onChange={(e) => setUserVolume(p.userId, Number(e.target.value))}
                        className="flex-1 h-1 cursor-pointer"
                      />
                      <span className="text-xs w-8 text-right" style={{ color: 'var(--color-text-secondary)' }}>
                        {userVolumes[p.userId] ?? 100}%
                      </span>
                    </div>
                  </div>
                ),
              },
            ];
            const row = (
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors" style={{ background: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="relative">
                  <Avatar
                    userId={p.userId}
                    src={member?.avatar ?? member?.user?.avatar}
                    displayName={displayName}
                    size="sm"
                    status={status}
                  />
                  {p.speaking && (
                    <div className="absolute -inset-0.5 rounded-full animate-pulse" style={{ border: '2px solid var(--color-accent-primary)', opacity: 0.7 }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block" style={{ color: 'var(--color-text-primary)' }}>{displayName}</span>
                </div>
                <div className="flex items-center gap-1">
                  {p.selfMute && (
                    <div className="w-4 h-4 flex items-center justify-center" title="Muted">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger-default)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg>
                    </div>
                  )}
                  {p.selfDeaf && (
                    <div className="w-4 h-4 flex items-center justify-center" title="Deafened">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger-default)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M2 12a10 10 0 0 1 18-6"/></svg>
                    </div>
                  )}
                  {p.screenSharing && (
                    <div className="w-4 h-4 flex items-center justify-center" title="Screen Sharing">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    </div>
                  )}
                </div>
              </div>
            );
            return isSelf ? (
              <Fragment key={p.userId}>{row}</Fragment>
            ) : (
              <ContextMenu key={p.userId} items={contextItems}>{row}</ContextMenu>
            );
          })}
          {participants.length === 0 && (
            <p className="text-xs py-2" style={{ color: 'var(--color-text-disabled)' }}>No participants</p>
          )}
        </div>
      </div>

      {/* Invite People */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-overlay)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
        >
          <UserPlus size={14} style={{ color: 'var(--color-accent-primary)' }} />
          Invite People
        </button>
      </div>

      {/* Optimized Audio */}
      {isConnected && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.1em' }}>
            Optimized Audio
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'var(--color-accent-subtle)' }}>
              <Shield size={13} style={{ color: 'var(--color-accent-primary)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-accent-primary)' }}>
                Optimized Audio Enabled
              </span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <Zap size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Audio Mode</span>
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{modeLabel}</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <Volume2 size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>High Bitrate</span>
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--color-status-online)' }}>Active</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MemberSidebar({ guildId, channelId, isVoiceChannel }: MemberSidebarProps) {
  const members = useGuildsStore((s) => s.members[guildId] ?? {});
  const roles = useGuildsStore((s) => s.roles);
  const presenceUsers = usePresenceStore((s) => s.users);
  const guild = useGuildsStore((s) => s.guilds[guildId]);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const isOwner = guild?.ownerId === currentUserId;

  const handleContextMenu = useCallback((e: React.MouseEvent, member: MemberPayload) => {
    e.preventDefault();
    setContextMenu({ member, position: { x: e.clientX, y: e.clientY } });
  }, []);

  // Group members by their highest hoisted role
  const grouped = useMemo(() => {
    const memberList = Object.values(members);
    const getUserPresence = (userId: string) => presenceUsers[userId]?.status ?? 'offline';

    // Collect hoisted roles for this guild, sorted by position desc
    const guildRoles = Object.values(roles)
      .filter((r) => r.guildId === guildId && r.hoist)
      .sort((a, b) => b.position - a.position);

    const groups: Array<{ role: RolePayload | null; members: MemberPayload[] }> = [];
    const assigned = new Set<string>();

    for (const role of guildRoles) {
      const roleMembers = memberList.filter(
        (m) => m.roles.includes(role.id) && !assigned.has(m.userId) && getUserPresence(m.userId) !== 'offline'
      );
      if (roleMembers.length > 0) {
        roleMembers.forEach((m) => assigned.add(m.userId));
        groups.push({ role, members: roleMembers });
      }
    }

    // Online members without a hoisted role
    const onlineOther = memberList.filter(
      (m) => !assigned.has(m.userId) && getUserPresence(m.userId) !== 'offline'
    );
    if (onlineOther.length > 0) {
      groups.push({ role: null, members: onlineOther });
    }

    // Offline members (including those with hoisted roles who are offline)
    const offline = memberList.filter(
      (m) => !assigned.has(m.userId) && getUserPresence(m.userId) === 'offline'
    );
    if (offline.length > 0) {
      groups.push({
        role: { id: '__offline', name: 'Offline', position: -1 } as RolePayload,
        members: offline,
      });
    }

    return groups;
  }, [members, roles, guildId, presenceUsers]);

  // Flatten groups into virtualised list items: header rows + member rows
  type ListItem =
    | { kind: 'header'; role: RolePayload | null; count: number; key: string }
    | { kind: 'member'; member: MemberPayload; nameColor?: string; key: string };

  const listItems = useMemo(() => {
    const items: ListItem[] = [];
    for (const { role, members: groupMembers } of grouped) {
      items.push({ kind: 'header', role, count: groupMembers.length, key: `h-${role?.id ?? 'online'}` });
      for (const member of groupMembers) {
        const topColorRole = member.roles
          .map((rid) => roles[rid])
          .filter((r): r is RolePayload => r != null && r.color > 0)
          .sort((a, b) => b.position - a.position)[0];
        const nameColor = topColorRole
          ? '#' + topColorRole.color.toString(16).padStart(6, '0')
          : undefined;
        items.push({ kind: 'member', member, nameColor, key: member.userId });
      }
    }
    return items;
  }, [grouped, roles]);

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: 'var(--layout-member-sidebar-width)',
        background: 'rgba(18, 22, 22, 0.5)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid var(--color-border-subtle)',
        flexShrink: 0,
      }}
      aria-label={isVoiceChannel ? 'Room Info' : 'Members'}
    >
      {isVoiceChannel && channelId ? (
        <VoiceContextPanel channelId={channelId} guildId={guildId} />
      ) : (
      <Virtuoso
        style={{ height: '100%' }}
        totalCount={listItems.length}
        itemContent={(index) => {
          const item = listItems[index];
          if (!item) return null;

          if (item.kind === 'header') {
            return (
              <p
                className="px-4 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{
                  color: item.role && item.role.color
                    ? '#' + item.role.color.toString(16).padStart(6, '0')
                    : 'var(--color-text-disabled)',
                  paddingTop: index === 0 ? '16px' : '12px',
                }}
              >
                {item.role?.name ?? 'Online'} — {item.count}
              </p>
            );
          }

          return (
            <div className="px-2">
              <MemberItem
                member={item.member}
                onContextMenu={handleContextMenu}
                nameColor={item.nameColor}
              />
            </div>
          );
        }}
      />
      )}

      {contextMenu && (
        <MemberContextMenu
          guildId={guildId}
          member={contextMenu.member}
          position={contextMenu.position}
          isOwner={isOwner}
          onClose={() => setContextMenu(null)}
        />
      )}
    </aside>
  );
}
