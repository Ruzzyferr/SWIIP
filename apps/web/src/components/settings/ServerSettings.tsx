'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Settings,
  Shield,
  Users,
  Hash,
  Ban,
  ScrollText,
  Trash2,
  Camera,
  Pencil,
  Volume2,
  Megaphone,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGuildsStore } from '@/stores/guilds.store';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { updateGuild, deleteGuild, kickMember, banMember, updateMember } from '@/lib/api/guilds.api';
import { toastSuccess, toastError } from '@/lib/toast';
import { ChannelType } from '@constchat/protocol';
import { RolesPage } from './RolesPage';
import { AuditLogPage } from './AuditLogPage';
import { BanListPage } from './BanListPage';

// ---------------------------------------------------------------------------
// Nav structure
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: Settings, section: 'Server Settings' },
  { id: 'roles', label: 'Roles', icon: Shield, section: 'Server Settings' },
  { id: 'members', label: 'Members', icon: Users, section: 'Server Settings' },
  { id: 'channels', label: 'Channels', icon: Hash, section: 'Server Settings' },
  { id: 'bans', label: 'Bans', icon: Ban, section: 'Moderation' },
  { id: 'audit-log', label: 'Audit Log', icon: ScrollText, section: 'Moderation' },
];

// ---------------------------------------------------------------------------
// Overview page
// ---------------------------------------------------------------------------

function OverviewPage({ guildId }: { guildId: string }) {
  const guild = useGuildsStore((s) => s.guilds[guildId]);
  const updateGuildStore = useGuildsStore((s) => s.updateGuild);

  const [name, setName] = useState(guild?.name ?? '');
  const [description, setDescription] = useState((guild as any)?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateGuild(guildId, { name, description: description || undefined });
      updateGuildStore(guildId, updated);
      setHasChanges(false);
      toastSuccess('Server settings saved!');
    } catch (err: any) {
      toastError(err?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setName(guild?.name ?? '');
    setDescription((guild as any)?.description ?? '');
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
        Server Overview
      </h2>

      <div className="flex gap-6">
        {/* Icon */}
        <div className="flex-shrink-0">
          <button
            className="w-24 h-24 rounded-[28px] flex flex-col items-center justify-center gap-1 transition-colors relative group"
            style={{
              background: 'var(--color-surface-raised)',
              border: '2px dashed var(--color-border-strong)',
            }}
          >
            {guild?.icon ? (
              <Avatar src={guild.icon} displayName={guild.name} size="2xl" />
            ) : (
              <>
                <Camera size={24} style={{ color: 'var(--color-text-tertiary)' }} />
                <span className="text-[10px] font-semibold uppercase"
                  style={{ color: 'var(--color-text-tertiary)' }}>
                  Upload
                </span>
              </>
            )}
          </button>
          <p className="text-xs text-center mt-2" style={{ color: 'var(--color-text-disabled)' }}>
            Min 128x128
          </p>
        </div>

        {/* Fields */}
        <div className="flex-1 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--color-text-secondary)' }}>
              Server Name
            </label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setHasChanges(true); }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--color-text-secondary)' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
              placeholder="Tell people what this server is about"
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{
                background: 'var(--color-surface-base)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-default)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Save bar */}
      {hasChanges && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between rounded-lg px-4 py-3"
          style={{
            background: 'var(--color-surface-overlay)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            You have unsaved changes!
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleReset} size="sm">Reset</Button>
            <Button onClick={handleSave} loading={saving} size="sm">Save Changes</Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Members page
// ---------------------------------------------------------------------------

function MembersPage({ guildId }: { guildId: string }) {
  const members = useGuildsStore((s) => s.members[guildId] ?? {});
  const guild = useGuildsStore((s) => s.guilds[guildId]);
  const allRoles = useGuildsStore((s) => s.roles);
  const removeMember = useGuildsStore((s) => s.removeMember);
  const updateMemberStore = useGuildsStore((s) => s.updateMember);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isOwner = guild?.ownerId === currentUserId;
  const [search, setSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: 'kick' | 'ban'; userId: string } | null>(null);
  const [roleDropdownUserId, setRoleDropdownUserId] = useState<string | null>(null);

  const guildRoles = Object.values(allRoles)
    .filter((r) => r.guildId === guildId && r.name !== '@everyone')
    .sort((a, b) => b.position - a.position);

  const memberList = Object.values(members).filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (m.nick ?? m.user?.globalName ?? m.user?.username ?? '').toLowerCase();
    return name.includes(q);
  });

  const handleKick = async (userId: string) => {
    try {
      await kickMember(guildId, userId);
      removeMember(guildId, userId);
      toastSuccess('Member kicked');
      setConfirmAction(null);
    } catch {
      toastError('Failed to kick member');
    }
  };

  const handleBan = async (userId: string) => {
    try {
      await banMember(guildId, userId);
      removeMember(guildId, userId);
      toastSuccess('Member banned');
      setConfirmAction(null);
    } catch {
      toastError('Failed to ban member');
    }
  };

  const handleToggleRole = async (userId: string, roleId: string, currentRoles: string[]) => {
    const hasRole = currentRoles.includes(roleId);
    const newRoles = hasRole
      ? currentRoles.filter((r) => r !== roleId)
      : [...currentRoles, roleId];
    try {
      await updateMember(guildId, userId, { roles: newRoles });
      updateMemberStore(guildId, userId, { roles: newRoles });
      toastSuccess(hasRole ? 'Role removed' : 'Role assigned');
    } catch {
      toastError('Failed to update roles');
    }
  };

  const colorToHex = (c: number) => '#' + c.toString(16).padStart(6, '0');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Members — {memberList.length}
        </h2>
        <div className="relative">
          <input
            placeholder="Search members"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md px-3 py-1.5 text-sm outline-none"
            style={{
              background: 'var(--color-surface-base)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-default)',
              width: 200,
            }}
          />
        </div>
      </div>

      <div className="space-y-1">
        {memberList.map((member) => {
          const displayName = member.nick ?? member.user?.globalName ?? member.user?.username ?? member.userId;
          const isSelf = member.userId === currentUserId;
          const isMemberOwner = member.userId === guild?.ownerId;
          const memberRoleObjects = (member.roles ?? [])
            .map((rid) => allRoles[rid])
            .filter((r): r is NonNullable<typeof r> => r != null)
            .sort((a, b) => b.position - a.position);

          return (
            <div
              key={member.userId}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg group"
              style={{ background: 'var(--color-surface-raised)' }}
            >
              <Avatar
                displayName={displayName}
                userId={member.userId}
                src={member.avatar ?? member.user?.avatar}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block"
                  style={{ color: 'var(--color-text-primary)' }}>
                  {displayName}
                  {isMemberOwner && (
                    <span className="ml-1.5 text-xs" style={{ color: 'var(--color-warning-default)' }}>
                      Owner
                    </span>
                  )}
                </span>
                <span className="text-xs block" style={{ color: 'var(--color-text-tertiary)' }}>
                  @{member.user?.username ?? member.userId}
                </span>
                {/* Role tags */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {memberRoleObjects.map((role) => (
                    <span key={role.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ background: 'var(--color-surface-overlay)', color: role.color ? colorToHex(role.color) : 'var(--color-text-secondary)' }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: role.color ? colorToHex(role.color) : 'var(--color-text-disabled)' }} />
                      {role.name}
                    </span>
                  ))}
                  {/* Add role button */}
                  {isOwner && !isMemberOwner && (
                    <div className="relative">
                      <button
                        onClick={() => setRoleDropdownUserId(roleDropdownUserId === member.userId ? null : member.userId)}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] transition-colors"
                        style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-tertiary)' }}
                      >
                        +
                      </button>
                      {roleDropdownUserId === member.userId && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setRoleDropdownUserId(null)} />
                          <div className="absolute left-0 top-full mt-1 z-20 rounded-xl py-1 w-48 max-h-48 overflow-y-auto shadow-lg"
                            style={{ background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-subtle)' }}>
                            {guildRoles.length === 0 ? (
                              <p className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>No roles available</p>
                            ) : guildRoles.map((role) => {
                              const has = (member.roles ?? []).includes(role.id);
                              return (
                                <button
                                  key={role.id}
                                  onClick={() => handleToggleRole(member.userId, role.id, member.roles ?? [])}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors"
                                  style={{ color: 'var(--color-text-primary)' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                  <div className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ background: role.color ? colorToHex(role.color) : 'var(--color-text-disabled)' }} />
                                  <span className="flex-1 truncate">{role.name}</span>
                                  {has && <span className="text-xs" style={{ color: 'var(--color-accent-primary)' }}>✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {isOwner && !isSelf && !isMemberOwner && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {confirmAction?.userId === member.userId ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs mr-1" style={{ color: 'var(--color-text-tertiary)' }}>
                        {confirmAction.type === 'kick' ? 'Kick?' : 'Ban?'}
                      </span>
                      <button
                        onClick={() =>
                          confirmAction.type === 'kick'
                            ? handleKick(member.userId)
                            : handleBan(member.userId)
                        }
                        className="px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ background: 'var(--color-danger-default)' }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-overlay)' }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmAction({ type: 'kick', userId: member.userId })}
                        className="px-2 py-1 rounded text-xs transition-colors"
                        style={{ color: 'var(--color-danger-default)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-muted)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        title="Kick member"
                      >
                        Kick
                      </button>
                      <button
                        onClick={() => setConfirmAction({ type: 'ban', userId: member.userId })}
                        className="px-2 py-1 rounded text-xs transition-colors"
                        style={{ color: 'var(--color-danger-default)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-muted)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        title="Ban member"
                      >
                        Ban
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {memberList.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
            {search ? 'No members match your search' : 'No members loaded'}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channels page
// ---------------------------------------------------------------------------

function ChannelsPage({ guildId }: { guildId: string }) {
  const allChannels = useGuildsStore((s) => s.channels);
  const updateChannelStore = useGuildsStore((s) => s.updateChannel);
  const removeChannelStore = useGuildsStore((s) => s.removeChannel);

  const channels = Object.values(allChannels)
    .filter((ch: any) => ch.guildId === guildId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [saving, setSaving] = useState(false);

  const getChannelIcon = (type: ChannelType) => {
    switch (type) {
      case ChannelType.VOICE: return <Volume2 size={14} style={{ color: 'var(--color-text-tertiary)' }} />;
      case ChannelType.ANNOUNCEMENT: return <Megaphone size={14} style={{ color: 'var(--color-text-tertiary)' }} />;
      case ChannelType.CATEGORY: return null;
      default: return <Hash size={14} style={{ color: 'var(--color-text-tertiary)' }} />;
    }
  };

  const handleEdit = (ch: any) => {
    setEditingId(ch.id);
    setEditName(ch.name);
    setEditTopic(ch.topic ?? '');
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const { updateChannel } = await import('@/lib/api/channels.api');
      const updated = await updateChannel(editingId, { name: editName, topic: editTopic || undefined });
      updateChannelStore(editingId, updated);
      setEditingId(null);
      toastSuccess('Channel updated');
    } catch (err: any) {
      toastError(err?.response?.data?.message ?? 'Failed to update channel');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (channelId: string) => {
    try {
      const { deleteChannel } = await import('@/lib/api/channels.api');
      await deleteChannel(channelId);
      removeChannelStore(channelId);
      toastSuccess('Channel deleted');
    } catch (err: any) {
      toastError(err?.response?.data?.message ?? 'Failed to delete channel');
    }
  };

  // Group channels by category
  const categories = channels.filter((ch) => ch.type === ChannelType.CATEGORY);
  const uncategorized = channels.filter((ch: any) => ch.type !== ChannelType.CATEGORY && !ch.parentId && !ch.categoryId);

  const getChildChannels = (categoryId: string) =>
    channels.filter((ch: any) => ch.type !== ChannelType.CATEGORY && (ch.parentId === categoryId || ch.categoryId === categoryId));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
        Channels — {channels.filter((c) => c.type !== ChannelType.CATEGORY).length}
      </h2>

      <div className="space-y-4">
        {/* Uncategorized */}
        {uncategorized.length > 0 && (
          <div className="space-y-0.5">
            {uncategorized.map((ch) => (
              <ChannelRow key={ch.id} channel={ch} getChannelIcon={getChannelIcon}
                editingId={editingId} editName={editName} editTopic={editTopic}
                saving={saving} setEditName={setEditName} setEditTopic={setEditTopic}
                onEdit={handleEdit} onSave={handleSave} onCancel={() => setEditingId(null)}
                onDelete={handleDelete} />
            ))}
          </div>
        )}

        {/* Categories with children */}
        {categories.map((cat) => {
          const children = getChildChannels(cat.id);
          return (
            <div key={cat.id}>
              <div className="flex items-center gap-2 px-2 py-1.5 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-disabled)' }}>
                  {cat.name}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--color-text-disabled)' }}>
                  ({children.length})
                </span>
              </div>
              <div className="space-y-0.5 ml-2">
                {children.map((ch) => (
                  <ChannelRow key={ch.id} channel={ch} getChannelIcon={getChannelIcon}
                    editingId={editingId} editName={editName} editTopic={editTopic}
                    saving={saving} setEditName={setEditName} setEditTopic={setEditTopic}
                    onEdit={handleEdit} onSave={handleSave} onCancel={() => setEditingId(null)}
                    onDelete={handleDelete} />
                ))}
                {children.length === 0 && (
                  <p className="text-xs px-3 py-2" style={{ color: 'var(--color-text-disabled)' }}>
                    No channels in this category
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChannelRow({
  channel,
  getChannelIcon,
  editingId,
  editName,
  editTopic,
  saving,
  setEditName,
  setEditTopic,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  channel: any;
  getChannelIcon: (type: ChannelType) => React.ReactNode;
  editingId: string | null;
  editName: string;
  editTopic: string;
  saving: boolean;
  setEditName: (v: string) => void;
  setEditTopic: (v: string) => void;
  onEdit: (ch: any) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}) {
  const isEditing = editingId === channel.id;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg group"
      style={{ background: 'var(--color-surface-raised)' }}
    >
      {getChannelIcon(channel.type)}
      {isEditing ? (
        <div className="flex-1 space-y-1">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded px-2 py-1 text-sm outline-none"
            style={{ background: 'var(--color-surface-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
          />
          <input
            value={editTopic}
            onChange={(e) => setEditTopic(e.target.value)}
            placeholder="Channel topic"
            className="w-full rounded px-2 py-1 text-xs outline-none"
            style={{ background: 'var(--color-surface-base)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}
          />
          <div className="flex gap-1">
            <Button onClick={onSave} loading={saving} size="sm">Save</Button>
            <Button variant="ghost" onClick={onCancel} size="sm">Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <span className="text-sm flex-1 truncate" style={{ color: 'var(--color-text-primary)' }}>
            {channel.name}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(channel)}
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--color-text-tertiary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
            >
              <Pencil size={12} />
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger-default)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
              >
                <Trash2 size={12} />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button onClick={() => onDelete(channel.id)}
                  className="px-2 py-0.5 rounded text-xs text-white"
                  style={{ background: 'var(--color-danger-default)' }}>
                  Delete
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 rounded text-xs"
                  style={{ color: 'var(--color-text-secondary)', background: 'var(--color-surface-overlay)' }}>
                  No
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder page
// ---------------------------------------------------------------------------

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Settings size={48} style={{ color: 'var(--color-text-disabled)' }} />
      <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
        {title}
      </h2>
      <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
        This section is coming soon.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Danger zone
// ---------------------------------------------------------------------------

function DangerZone({ guildId, onDeleted }: { guildId: string; onDeleted: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const removeGuild = useGuildsStore((s) => s.removeGuild);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteGuild(guildId);
      removeGuild(guildId);
      toastSuccess('Server deleted');
      onDeleted();
    } catch (err: any) {
      toastError(err?.message ?? 'Failed to delete server');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      <h3 className="text-sm font-bold uppercase tracking-wide mb-3"
        style={{ color: 'var(--color-danger-default)' }}>
        Danger Zone
      </h3>
      {!confirmDelete ? (
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={14} className="mr-1" />
          Delete Server
        </Button>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-sm" style={{ color: 'var(--color-danger-default)' }}>
            Are you sure? This cannot be undone.
          </p>
          <Button variant="danger" onClick={handleDelete} loading={deleting} size="sm">
            Confirm Delete
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)} size="sm">
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main server settings overlay
// ---------------------------------------------------------------------------

interface ServerSettingsProps {
  guildId: string;
  onClose: () => void;
}

export function ServerSettings({ guildId, onClose }: ServerSettingsProps) {
  const [activePage, setActivePage] = useState('overview');
  const guild = useGuildsStore((s) => s.guilds[guildId]);
  const router = useRouter();

  const handleServerDeleted = () => {
    onClose();
    router.push('/channels/@me');
  };

  // Group nav items by section
  const sections = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section]!.push(item);
    return acc;
  }, {});

  const renderPage = () => {
    switch (activePage) {
      case 'overview':
        return (
          <>
            <OverviewPage guildId={guildId} />
            <DangerZone guildId={guildId} onDeleted={handleServerDeleted} />
          </>
        );
      case 'roles':
        return <RolesPage guildId={guildId} />;
      case 'members':
        return <MembersPage guildId={guildId} />;
      case 'channels':
        return <ChannelsPage guildId={guildId} />;
      case 'bans':
        return <BanListPage guildId={guildId} />;
      case 'audit-log':
        return <AuditLogPage guildId={guildId} />;
      default:
        return <PlaceholderPage title={NAV_ITEMS.find((i) => i.id === activePage)?.label ?? activePage} />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex"
        style={{ zIndex: 'var(--z-modal)', background: 'var(--color-surface-base)' }}
      >
        {/* Sidebar */}
        <div
          className="w-56 flex-shrink-0 flex flex-col h-full overflow-y-auto py-6 px-3"
          style={{
            background: 'var(--color-surface-elevated)',
            borderRight: '1px solid var(--color-border-subtle)',
          }}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider px-2 mb-3"
            style={{ color: 'var(--color-text-disabled)' }}>
            {guild?.name ?? 'Server'} Settings
          </h3>

          {Object.entries(sections).map(([section, items]) => (
            <div key={section} className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider px-2 mb-1"
                style={{ color: 'var(--color-text-disabled)' }}>
                {section}
              </p>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors mb-0.5"
                    style={{
                      background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
                      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto py-8 px-10">
            {renderPage()}
          </div>
        </div>

        {/* Close button — pushed below Electron titlebar overlay (32px) */}
        <button
          onClick={onClose}
          className="absolute right-4 p-2 rounded-full transition-colors"
          style={{
            top: 'calc(env(titlebar-area-height, 32px) + 8px)',
            color: 'var(--color-text-tertiary)',
            border: '2px solid var(--color-border-default)',
          }}
          aria-label="Close settings"
        >
          <X size={20} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
