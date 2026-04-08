'use client';

import { useEffect, useState, useCallback } from 'react';
import { Shield, Check, Loader2 } from 'lucide-react';
import { getSelfAssignableRoles, selfAssignRole, selfRemoveRole } from '@/lib/api/roles.api';
import { useGuildsStore } from '@/stores/guilds.store';
import { useAuthStore } from '@/stores/auth.store';
import type { RolePayload } from '@constchat/protocol';

export function RolePicker({ guildId }: { guildId: string }) {
  const [roles, setRoles] = useState<RolePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const userId = useAuthStore((s) => s.user?.id);
  const member = useGuildsStore((s) => (userId ? s.members[guildId]?.[userId] : undefined));
  const myRoles = (member as unknown as Record<string, unknown>)?.roles as string[] | undefined;

  const load = useCallback(async () => {
    try {
      const data = await getSelfAssignableRoles(guildId);
      setRoles(data);
    } catch {
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (roleId: string, hasRole: boolean) => {
    setToggling(roleId);
    try {
      if (hasRole) {
        await selfRemoveRole(guildId, roleId);
      } else {
        await selfAssignRole(guildId, roleId);
      }
      // Refresh member data
      const { getGuildMembers } = await import('@/lib/api/guilds.api');
      const members = await getGuildMembers(guildId);
      useGuildsStore.getState().setMembers(guildId, members);
    } catch {
      // ignore
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-text-disabled)' }} />
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="text-center py-8">
        <Shield size={32} className="mx-auto mb-2" style={{ color: 'var(--color-text-disabled)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>
          No self-assignable roles available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
          Pick Your Roles
        </h3>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Click to toggle roles on or off.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {roles.map((role) => {
          const hasRole = myRoles?.includes(role.id) ?? false;
          const isToggling = toggling === role.id;
          const color = role.color && role.color !== 0
            ? `#${role.color.toString(16).padStart(6, '0')}`
            : 'var(--color-text-secondary)';

          return (
            <button
              key={role.id}
              onClick={() => handleToggle(role.id, hasRole)}
              disabled={isToggling}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                border: `2px solid ${color}`,
                background: hasRole ? color : 'transparent',
                color: hasRole ? '#fff' : color,
                opacity: isToggling ? 0.6 : 1,
              }}
            >
              {isToggling ? (
                <Loader2 size={12} className="animate-spin" />
              ) : hasRole ? (
                <Check size={12} />
              ) : null}
              {role.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
