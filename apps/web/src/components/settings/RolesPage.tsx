'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { RolePayload } from '@constchat/protocol';
import { useGuildsStore } from '@/stores/guilds.store';
import { getGuildRoles, createRole, updateRole, deleteRole } from '@/lib/api/roles.api';
import { toastSuccess, toastError } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// ── Permission definitions ─────────────────────────────────────────────────
const PERMISSIONS = [
  { key: 'ADMINISTRATOR', bit: 0x8, label: 'Administrator', description: 'Full access to all settings and actions' },
  { key: 'MANAGE_GUILD', bit: 0x20, label: 'Manage Server', description: 'Edit server name, icon, and settings' },
  { key: 'MANAGE_ROLES', bit: 0x10000000, label: 'Manage Roles', description: 'Create, edit, delete roles below this one' },
  { key: 'MANAGE_CHANNELS', bit: 0x10, label: 'Manage Channels', description: 'Create, edit, delete channels' },
  { key: 'KICK_MEMBERS', bit: 0x2, label: 'Kick Members', description: 'Remove members from the server' },
  { key: 'BAN_MEMBERS', bit: 0x4, label: 'Ban Members', description: 'Permanently ban members' },
  { key: 'MANAGE_MESSAGES', bit: 0x2000, label: 'Manage Messages', description: 'Delete or pin messages from other members' },
  { key: 'MENTION_EVERYONE', bit: 0x20000, label: 'Mention @everyone', description: 'Use @everyone and @here mentions' },
  { key: 'MUTE_MEMBERS', bit: 0x400000, label: 'Mute Members', description: 'Mute members in voice channels' },
  { key: 'DEAFEN_MEMBERS', bit: 0x800000, label: 'Deafen Members', description: 'Deafen members in voice channels' },
  { key: 'MOVE_MEMBERS', bit: 0x1000000, label: 'Move Members', description: 'Move members between voice channels' },
  { key: 'SEND_MESSAGES', bit: 0x800, label: 'Send Messages', description: 'Send messages in text channels' },
  { key: 'EMBED_LINKS', bit: 0x4000, label: 'Embed Links', description: 'Links will show embedded content' },
  { key: 'ATTACH_FILES', bit: 0x8000, label: 'Attach Files', description: 'Upload files and images' },
  { key: 'READ_MESSAGE_HISTORY', bit: 0x10000, label: 'Read Message History', description: 'View past messages' },
  { key: 'CONNECT', bit: 0x100000, label: 'Connect', description: 'Join voice channels' },
  { key: 'SPEAK', bit: 0x200000, label: 'Speak', description: 'Talk in voice channels' },
  { key: 'USE_VAD', bit: 0x2000000, label: 'Use Voice Activity', description: 'Use voice activity detection' },
  { key: 'CHANGE_NICKNAME', bit: 0x4000000, label: 'Change Nickname', description: 'Change own server nickname' },
  { key: 'MANAGE_NICKNAMES', bit: 0x8000000, label: 'Manage Nicknames', description: 'Change nicknames of other members' },
];

const PRESET_COLORS = [
  0x5865F2, 0x57F287, 0xFEE75C, 0xEB459E, 0xED4245,
  0xE67E22, 0x1ABC9C, 0x3498DB, 0x9B59B6, 0xE91E63,
  0x11806A, 0x1F8B4C, 0xC27C0E, 0xA84300, 0x992D22,
  0x2C2F33, 0x95A5A6, 0x607D8B,
];

function colorToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

function hexToColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function hasPermission(perms: string, bit: number): boolean {
  const val = BigInt(perms || '0');
  return (val & BigInt(bit)) === BigInt(bit);
}

function togglePermission(perms: string, bit: number): string {
  const val = BigInt(perms || '0');
  if ((val & BigInt(bit)) === BigInt(bit)) {
    return (val & ~BigInt(bit)).toString();
  }
  return (val | BigInt(bit)).toString();
}

// ── Role Editor ─────────────────────────────────────────────────────────────

function RoleEditor({
  role,
  guildId,
  onSaved,
  onDeleted,
}: {
  role: RolePayload;
  guildId: string;
  onSaved: (r: RolePayload) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(role.color);
  const [hoist, setHoist] = useState(role.hoist);
  const [mentionable, setMentionable] = useState(role.mentionable);
  const [selfAssignable, setSelfAssignable] = useState((role as any).selfAssignable ?? false);
  const [permissions, setPermissions] = useState(role.permissions);
  const [saving, setSaving] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasChanges =
    name !== role.name ||
    color !== role.color ||
    hoist !== role.hoist ||
    mentionable !== role.mentionable ||
    selfAssignable !== ((role as any).selfAssignable ?? false) ||
    permissions !== role.permissions;

  const isEveryone = role.name === '@everyone';

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateRole(guildId, role.id, {
        name: isEveryone ? undefined : name,
        color,
        hoist,
        mentionable,
        selfAssignable,
        permissions,
      } as any);
      onSaved(updated);
      toastSuccess('Role updated');
    } catch (err: any) {
      toastError(err?.response?.data?.message ?? 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRole(guildId, role.id);
      onDeleted(role.id);
      toastSuccess('Role deleted');
    } catch (err: any) {
      toastError(err?.response?.data?.message ?? 'Failed to delete role');
    }
  };

  return (
    <div className="space-y-6">
      {/* Name */}
      {!isEveryone && (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5"
            style={{ color: 'var(--color-text-secondary)' }}>
            Role Name
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}

      {/* Color */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide mb-2"
          style={{ color: 'var(--color-text-secondary)' }}>
          Role Color
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full transition-transform hover:scale-110"
              style={{
                background: colorToHex(c),
                outline: color === c ? '2px solid var(--color-text-primary)' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
          <div className="relative">
            <input
              type="color"
              value={colorToHex(color || 0x99AAB5)}
              onChange={(e) => setColor(hexToColor(e.target.value))}
              className="w-8 h-8 rounded-full cursor-pointer border-0 p-0"
              style={{ background: 'transparent' }}
              title="Custom color"
            />
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Display separately
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Show members with this role separately in the sidebar
            </p>
          </div>
          <button
            onClick={() => setHoist(!hoist)}
            className="relative w-11 h-6 rounded-full transition-colors duration-200"
            style={{
              background: hoist ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
              border: hoist ? 'none' : '1px solid var(--color-border-default)',
            }}
          >
            <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: hoist ? 'translateX(22px)' : 'translateX(2px)' }} />
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Allow anyone to @mention this role
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Members can mention this role in messages
            </p>
          </div>
          <button
            onClick={() => setMentionable(!mentionable)}
            className="relative w-11 h-6 rounded-full transition-colors duration-200"
            style={{
              background: mentionable ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
              border: mentionable ? 'none' : '1px solid var(--color-border-default)',
            }}
          >
            <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: mentionable ? 'translateX(22px)' : 'translateX(2px)' }} />
          </button>
        </div>

        {/* Self-assignable */}
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Self-assignable
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Members can pick this role themselves from the role picker
            </p>
          </div>
          <button
            onClick={() => setSelfAssignable(!selfAssignable)}
            className="relative w-11 h-6 rounded-full transition-colors duration-200"
            style={{
              background: selfAssignable ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
              border: selfAssignable ? 'none' : '1px solid var(--color-border-default)',
            }}
          >
            <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: selfAssignable ? 'translateX(22px)' : 'translateX(2px)' }} />
          </button>
        </div>
      </div>

      {/* Permissions */}
      <div>
        <button
          onClick={() => setShowPerms(!showPerms)}
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {showPerms ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Permissions
        </button>

        {showPerms && (
          <div className="space-y-1 rounded-xl p-4" style={{ background: 'var(--color-surface-raised)' }}>
            {PERMISSIONS.map((perm) => (
              <div key={perm.key} className="flex items-center justify-between py-2">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {perm.label}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    {perm.description}
                  </p>
                </div>
                <button
                  onClick={() => setPermissions(togglePermission(permissions, perm.bit))}
                  className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
                  style={{
                    background: hasPermission(permissions, perm.bit) ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
                    border: hasPermission(permissions, perm.bit) ? 'none' : '1px solid var(--color-border-default)',
                  }}
                >
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                    style={{ transform: hasPermission(permissions, perm.bit) ? 'translateX(22px)' : 'translateX(2px)' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save bar */}
      {hasChanges && (
        <div className="flex items-center justify-between rounded-lg px-4 py-3"
          style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-subtle)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            You have unsaved changes!
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => {
              setName(role.name);
              setColor(role.color);
              setHoist(role.hoist);
              setMentionable(role.mentionable);
              setSelfAssignable((role as any).selfAssignable ?? false);
              setPermissions(role.permissions);
            }}>
              Reset
            </Button>
            <Button onClick={handleSave} loading={saving} size="sm">Save Changes</Button>
          </div>
        </div>
      )}

      {/* Delete */}
      {!isEveryone && (
        <div className="pt-4" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          {!confirmDelete ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)} size="sm">
              <Trash2 size={14} className="mr-1" /> Delete Role
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: 'var(--color-danger-default)' }}>
                Delete this role? This cannot be undone.
              </span>
              <Button variant="danger" onClick={handleDelete} size="sm">Confirm</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)} size="sm">Cancel</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Roles Page ──────────────────────────────────────────────────────────────

export function RolesPage({ guildId }: { guildId: string }) {
  const storeRoles = useGuildsStore((s) => s.roles);
  const setRole = useGuildsStore((s) => s.setRole);
  const removeRole = useGuildsStore((s) => s.removeRole);

  const roles = Object.values(storeRoles)
    .filter((r) => r.guildId === guildId)
    .sort((a, b) => b.position - a.position);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selectedRole = selectedRoleId ? storeRoles[selectedRoleId] : null;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const role = await createRole(guildId, { name: 'new role', color: 0x99AAB5 });
      setRole(role);
      setSelectedRoleId(role.id);
      toastSuccess('Role created');
    } catch (err: any) {
      toastError(err?.response?.data?.message ?? 'Failed to create role');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Roles — {roles.length}
        </h2>
        <Button onClick={handleCreate} loading={creating} size="sm">
          <Plus size={14} className="mr-1" /> Create Role
        </Button>
      </div>

      <div className="flex gap-4" style={{ minHeight: 400 }}>
        {/* Role list */}
        <div className="w-48 flex-shrink-0 space-y-0.5 overflow-y-auto rounded-xl p-2"
          style={{ background: 'var(--color-surface-raised)' }}>
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left"
              style={{
                background: selectedRoleId === role.id ? 'var(--color-accent-subtle)' : 'transparent',
                color: 'var(--color-text-primary)',
              }}
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: role.color ? colorToHex(role.color) : 'var(--color-text-disabled)' }} />
              <span className="truncate">{role.name}</span>
            </button>
          ))}
          {roles.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-tertiary)' }}>
              No roles yet
            </p>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          {selectedRole ? (
            <RoleEditor
              key={selectedRole.id}
              role={selectedRole}
              guildId={guildId}
              onSaved={(r) => setRole(r)}
              onDeleted={(id) => {
                removeRole(id);
                setSelectedRoleId(null);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                Select a role to edit or create a new one
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
