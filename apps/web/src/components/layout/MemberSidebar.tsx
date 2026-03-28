'use client';

import { useMemo, useState, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Avatar } from '@/components/ui/Avatar';
import { MemberContextMenu } from '@/components/menus/MemberContextMenu';
import { useGuildsStore } from '@/stores/guilds.store';
import { usePresenceStore } from '@/stores/presence.store';
import { useAuthStore } from '@/stores/auth.store';
import type { MemberPayload, RolePayload } from '@constchat/protocol';

interface MemberSidebarProps {
  guildId: string;
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
    <button
      className="flex items-center gap-3 w-full px-2 py-1.5 rounded-lg transition-colors duration-fast"
      style={{
        opacity: status === 'offline' ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      onContextMenu={(e) => onContextMenu(e, member)}
      aria-label={displayName}
    >
      <Avatar
        userId={member.userId}
        src={member.avatar ?? member.user?.avatar ?? (member.user as { avatarId?: string } | undefined)?.avatarId}
        displayName={displayName}
        size="sm"
        status={status}
      />
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
    </button>
  );
}

export function MemberSidebar({ guildId }: MemberSidebarProps) {
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
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        borderLeft: '1px solid var(--color-border-subtle)',
        flexShrink: 0,
      }}
      aria-label="Members"
    >
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
