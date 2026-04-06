'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Pencil, Check, X, Loader2, Plus, Trash2, Link2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { updateProfile, uploadAvatar, uploadBanner, deleteAccount } from '@/lib/api/users.api';
import { CLEAR_AFTER_OPTIONS, scheduleStatusClear } from '@/lib/presence';
import { getGatewayClient } from '@/lib/gateway/GatewayClient';
import { toastError } from '@/lib/toast';
import { updateUserStatus } from '@/lib/presence';
import type { PresenceStatus } from '@constchat/protocol';

// ---------------------------------------------------------------------------
// Inline editable field
// ---------------------------------------------------------------------------

function EditableField({
  label,
  value,
  onSave,
  placeholder,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onSave: (val: string) => Promise<void>;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  return (
    <div className="flex justify-between items-start gap-4">
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-bold uppercase tracking-wide mb-1"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          {label}
        </p>
        {editing ? (
          <div className="flex items-center gap-2">
            {multiline ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={maxLength}
                rows={3}
                className="flex-1 bg-transparent rounded-lg px-3 py-2 text-sm outline-none resize-none"
                style={{
                  color: 'var(--color-text-primary)',
                  background: 'var(--color-surface-base)',
                  border: '1px solid var(--color-border-default)',
                }}
                placeholder={placeholder}
                autoFocus
              />
            ) : (
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={maxLength}
                className="flex-1 bg-transparent rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  color: 'var(--color-text-primary)',
                  background: 'var(--color-surface-base)',
                  border: '1px solid var(--color-border-default)',
                }}
                placeholder={placeholder}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--color-success-default)', color: '#fff' }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button
              onClick={handleCancel}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <p
            className="text-sm"
            style={{ color: value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}
          >
            {value || placeholder || 'Not set'}
          </p>
        )}
      </div>
      {!editing && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
        >
          Edit
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Page
// ---------------------------------------------------------------------------

export function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const getPresence = usePresenceStore((s) => s.getPresence);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const setPresence = usePresenceStore((s) => s.setPresence);
  const displayName = (user as any).displayName ?? user.globalName ?? user.username;
  const status = getPresence(user.id);
  const customStatus = usePresenceStore((s) => s.users[user.id]?.customStatus ?? '');
  const bio = (user as any).bio ?? '';
  const [profileLinks, setProfileLinks] = useState<{ label: string; url: string }[]>((user as any).profileLinks ?? []);
  const [statusDraft, setStatusDraft] = useState(customStatus);
  const [emojiDraft, setEmojiDraft] = useState(usePresenceStore.getState().users[user.id]?.customStatusEmoji ?? '');
  const [clearAfter, setClearAfter] = useState(0);
  const [editingStatus, setEditingStatus] = useState(false);
  const bannerUrl = (user as any).bannerId
    ? undefined // Will be handled by CDN URL from backend
    : undefined;

  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    try {
      const result = await uploadAvatar(file);
      updateUser({ avatar: result.s3Key } as any);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleBannerUpload = async (file: File) => {
    setBannerUploading(true);
    try {
      const result = await uploadBanner(file);
      updateUser({ bannerId: result.s3Key } as any);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to upload banner');
    } finally {
      setBannerUploading(false);
    }
  };

  const handleProfileUpdate = async (field: string, value: string) => {
    const updated = await updateProfile({ [field]: value });
    updateUser(updated);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
        My Account
      </h2>

      {/* Profile card */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--color-border-subtle)' }}
      >
        {/* Banner — clickable to upload */}
        <div
          className="h-32 relative group cursor-pointer"
          style={{
            background: bannerUrl
              ? `url(${bannerUrl}) center/cover`
              : 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-strong))',
          }}
          onClick={() => bannerInputRef.current?.click()}
        >
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-white text-sm font-medium">
              {bannerUploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Camera size={16} />
              )}
              Change Banner
            </div>
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleBannerUpload(file);
              e.target.value = '';
            }}
          />
        </div>

        {/* Profile info */}
        <div
          className="px-5 pb-5 relative"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <div className="flex items-end gap-4 -mt-12 mb-4">
            {/* Avatar — clickable to upload */}
            <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
              <div
                className="rounded-full p-1"
                style={{ background: 'var(--color-surface-raised)' }}
              >
                <Avatar
                  userId={user.id}
                  src={(user as any).avatarUrl ?? user.avatar}
                  displayName={displayName}
                  size="2xl"
                  status={status}
                />
              </div>
              <div className="absolute inset-1 rounded-full bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  {avatarUploading ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : (
                    <Camera size={20} className="text-white" />
                  )}
                </div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="pb-1">
              <h3
                className="text-lg font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {displayName}
              </h3>
              <p
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                @{user.username}#{user.discriminator}
              </p>
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg space-y-4"
              style={{ background: 'var(--color-surface-overlay)' }}
            >
              <EditableField
                label="Display Name"
                value={user.globalName ?? ''}
                onSave={(val) => handleProfileUpdate('globalName', val)}
                placeholder="How others see your name"
                maxLength={32}
              />

              <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

              <div className="flex justify-between items-center">
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: 'var(--color-text-disabled)' }}
                  >
                    Username
                  </p>
                  <p
                    className="text-sm mt-0.5"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {user.username}#{user.discriminator}
                  </p>
                </div>
              </div>

              <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

              <div className="flex justify-between items-center">
                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: 'var(--color-text-disabled)' }}
                  >
                    Email
                  </p>
                  <p
                    className="text-sm mt-0.5"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {user.email ?? '••••••@••••.com'}
                  </p>
                </div>
              </div>

              <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

              <EditableField
                label="About Me"
                value={bio}
                onSave={(val) => handleProfileUpdate('bio', val)}
                placeholder="Tell others about yourself"
                multiline
                maxLength={190}
              />

              <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

              {/* Profile Links */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-disabled)' }}>
                    Profile Links
                  </p>
                  {profileLinks.length < 5 && (
                    <button
                      onClick={() => setProfileLinks([...profileLinks, { label: '', url: '' }])}
                      className="flex items-center gap-1 text-xs"
                      style={{ color: 'var(--color-accent-primary)' }}
                    >
                      <Plus size={12} /> Add
                    </button>
                  )}
                </div>
                {profileLinks.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                    Add links to your profile (social media, website, etc.)
                  </p>
                )}
                <div className="space-y-2">
                  {profileLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Link2 size={14} className="flex-shrink-0" style={{ color: 'var(--color-text-disabled)' }} />
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => {
                          const updated = [...profileLinks];
                          updated[idx] = { ...updated[idx], label: e.target.value };
                          setProfileLinks(updated);
                        }}
                        placeholder="Label"
                        className="flex-1 px-2 py-1.5 rounded text-xs"
                        style={{
                          background: 'var(--color-surface-base)',
                          color: 'var(--color-text-primary)',
                          border: '1px solid var(--color-border-default)',
                        }}
                      />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => {
                          const updated = [...profileLinks];
                          updated[idx] = { ...updated[idx], url: e.target.value };
                          setProfileLinks(updated);
                        }}
                        placeholder="https://..."
                        className="flex-[2] px-2 py-1.5 rounded text-xs"
                        style={{
                          background: 'var(--color-surface-base)',
                          color: 'var(--color-text-primary)',
                          border: '1px solid var(--color-border-default)',
                        }}
                      />
                      <button
                        onClick={() => setProfileLinks(profileLinks.filter((_, i) => i !== idx))}
                        className="flex-shrink-0 p-1"
                        style={{ color: 'var(--color-text-disabled)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                {profileLinks.length > 0 && (
                  <button
                    onClick={async () => {
                      try {
                        const valid = profileLinks.filter((l) => l.url.trim());
                        await updateProfile({ profileLinks: valid });
                        setProfileLinks(valid);
                      } catch {
                        toastError('Failed to save links');
                      }
                    }}
                    className="mt-2 text-xs font-medium px-3 py-1.5 rounded-md"
                    style={{ background: 'var(--color-accent-primary)', color: '#fff' }}
                  >
                    Save Links
                  </button>
                )}
              </div>

              <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

              {/* Online Status Picker */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-disabled)' }}>
                  Status
                </p>
                <div className="flex gap-2">
                  {([
                    { value: 'online', label: 'Online', color: '#23a55a' },
                    { value: 'idle', label: 'Idle', color: '#f0b232' },
                    { value: 'dnd', label: 'Do Not Disturb', color: '#f23f43' },
                    { value: 'invisible', label: 'Invisible', color: '#80848e' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        updateUserStatus(user.id, opt.value, customStatus);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        background: status === opt.value ? 'var(--color-surface-base)' : 'transparent',
                        border: status === opt.value ? '1px solid var(--color-border-strong)' : '1px solid transparent',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

              {/* Custom Status */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-disabled)' }}>
                  Custom Status
                </p>
                {editingStatus ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {/* Emoji input */}
                      <input
                        type="text"
                        value={emojiDraft}
                        onChange={(e) => setEmojiDraft(e.target.value.slice(0, 2))}
                        placeholder="😊"
                        className="w-10 h-10 text-center text-lg rounded-lg outline-none"
                        style={{
                          background: 'var(--color-surface-base)',
                          border: '1px solid var(--color-border-default)',
                        }}
                      />
                      {/* Status text */}
                      <input
                        type="text"
                        value={statusDraft}
                        onChange={(e) => setStatusDraft(e.target.value)}
                        maxLength={128}
                        placeholder="What are you up to?"
                        className="flex-1 bg-transparent rounded-lg px-3 py-2 text-sm outline-none"
                        style={{
                          color: 'var(--color-text-primary)',
                          background: 'var(--color-surface-base)',
                          border: '1px solid var(--color-border-default)',
                        }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const expiresAt = clearAfter > 0
                              ? new Date(Date.now() + clearAfter).toISOString()
                              : clearAfter === -1
                                ? new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
                                : undefined;
                            updateUserStatus(user.id, status ?? 'online', statusDraft || undefined, emojiDraft || undefined, expiresAt);
                            if (clearAfter !== 0) scheduleStatusClear(user.id, status ?? 'online', clearAfter);
                            setEditingStatus(false);
                          }
                          if (e.key === 'Escape') {
                            setStatusDraft(customStatus);
                            setEditingStatus(false);
                          }
                        }}
                      />
                    </div>

                    {/* Clear after */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Clear after:</span>
                      <select
                        value={clearAfter}
                        onChange={(e) => setClearAfter(Number(e.target.value))}
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          background: 'var(--color-surface-base)',
                          color: 'var(--color-text-primary)',
                          border: '1px solid var(--color-border-default)',
                        }}
                      >
                        {CLEAR_AFTER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setStatusDraft(customStatus);
                          setEditingStatus(false);
                        }}
                        className="px-3 py-1.5 rounded-md text-xs font-medium"
                        style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const expiresAt = clearAfter > 0
                            ? new Date(Date.now() + clearAfter).toISOString()
                            : clearAfter === -1
                              ? new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
                              : undefined;
                          updateUserStatus(user.id, status ?? 'online', statusDraft || undefined, emojiDraft || undefined, expiresAt);
                          if (clearAfter !== 0) scheduleStatusClear(user.id, status ?? 'online', clearAfter);
                          setEditingStatus(false);
                        }}
                        className="px-3 py-1.5 rounded-md text-xs font-medium"
                        style={{ background: 'var(--color-success-default)', color: '#fff' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {usePresenceStore.getState().users[user.id]?.customStatusEmoji && (
                        <span className="text-lg">{usePresenceStore.getState().users[user.id]?.customStatusEmoji}</span>
                      )}
                      <p className="text-sm" style={{ color: customStatus ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                        {customStatus || 'No custom status set'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {customStatus && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            updateUserStatus(user.id, status ?? 'online', undefined, undefined, undefined);
                            setStatusDraft('');
                            setEmojiDraft('');
                          }}
                        >
                          Clear
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setStatusDraft(customStatus);
                          setEditingStatus(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-8">
        <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-disabled)' }}>
          Account Removal
        </h3>
        <div
          className="p-4 rounded-lg flex items-center justify-between"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Delete Account
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Permanently delete your account and all data. This cannot be undone.
            </p>
          </div>
          {!confirmDelete ? (
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              Delete Account
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium" style={{ color: 'var(--color-danger, #ef4444)' }}>
                Are you sure?
              </span>
              <Button
                variant="danger"
                size="sm"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteAccount();
                    logout();
                    window.location.href = '/';
                  } catch (err: any) {
                    toastError(err?.response?.data?.message ?? 'Failed to delete account');
                    setDeleting(false);
                    setConfirmDelete(false);
                  }
                }}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
