'use client';

import { useMemo, useState, useCallback } from 'react';
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
}: {
  member: MemberPayload;
  onContextMenu: (e: React.MouseEvent, member: MemberPayload) => void;
}) {
  const getPresence = usePresenceStore((s) => s.getPresence);
  const status = getPresence(member.userId);
  const displayName = member.nick ?? member.user?.globalName ?? member.user?.username ?? member.userId;

  return (
    <button
      className="flex items-center gap-3 w-full px-2 py-1.5 rounded-lg transition-colors duration-fast"
      style={{
        opacity: status === 'offline' ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-surface-raised)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      onContextMenu={(e) => onContextMenu(e, member)}
      aria-label={displayName}
    >
      <Avatar
        userId={member.userId}
        src={member.avatar ?? member.user?.avatar}
        displayName={displayName}
        size="sm"
        status={status}
      />
      <span
        className="text-sm truncate"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {displayName}
      </span>
    </button>
  );
}

export function MemberSidebar({ guildId }: MemberSidebarProps) {
  const members = useGuildsStore((s) => s.members[guildId] ?? {});
  const roles = useGuildsStore((s) => s.roles);
  const getPresence = usePresenceStore((s) => s.getPresence);
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

    // Collect hoisted roles for this guild, sorted by position desc
    const guildRoles = Object.values(roles)
      .filter((r) => r.guildId === guildId && r.hoist)
      .sort((a, b) => b.position - a.position);

    const groups: Array<{ role: RolePayload | null; members: MemberPayload[] }> = [];
    const assigned = new Set<string>();

    for (const role of guildRoles) {
      const roleMembers = memberList.filter(
        (m) => m.roles.includes(role.id) && !assigned.has(m.userId)
      );
      if (roleMembers.length > 0) {
        roleMembers.forEach((m) => assigned.add(m.userId));
        groups.push({ role, members: roleMembers });
      }
    }

    // Online members without a hoisted role
    const onlineOther = memberList.filter(
      (m) => !assigned.has(m.userId) && getPresence(m.userId) !== 'offline'
    );
    if (onlineOther.length > 0) {
      groups.push({ role: null, members: onlineOther });
    }

    // Offline members
    const offline = memberList.filter(
      (m) => !assigned.has(m.userId) && getPresence(m.userId) === 'offline'
    );
    if (offline.length > 0) {
      groups.push({
        role: { id: '__offline', name: 'Offline', position: -1 } as RolePayload,
        members: offline,
      });
    }

    return groups;
  }, [members, roles, guildId, getPresence]);

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto scroll-thin py-4"
      style={{
        width: 'var(--layout-member-sidebar-width)',
        background: 'var(--color-surface-elevated)',
        borderLeft: '1px solid var(--color-border-subtle)',
        flexShrink: 0,
      }}
      aria-label="Members"
    >
      {grouped.map(({ role, members: groupMembers }) => (
        <div key={role?.id ?? 'online'} className="mb-3">
          <p
            className="px-4 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-text-disabled)' }}
          >
            {role?.name ?? 'Online'} — {groupMembers.length}
          </p>
          <div className="px-2 space-y-0.5">
            {groupMembers.map((member) => (
              <MemberItem
                key={member.userId}
                member={member}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        </div>
      ))}

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
