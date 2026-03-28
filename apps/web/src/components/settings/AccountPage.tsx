'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Pencil, Check, X, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { updateProfile, uploadAvatar, uploadBanner } from '@/lib/api/users.api';
import { getGatewayClient } from '@/lib/gateway/GatewayClient';
import { toastError } from '@/lib/toast';
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
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const setPresence = usePresenceStore((s) => s.setPresence);
  const displayName = (user as any).displayName ?? user.globalName ?? user.username;
  const status = getPresence(user.id);
  const customStatus = usePresenceStore((s) => s.users[user.id]?.customStatus ?? '');
  const bio = (user as any).bio ?? '';
  const [statusDraft, setStatusDraft] = useState(customStatus);
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
    <div className="max-w-2xl">
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
                        const gw = getGatewayClient();
                        gw.updatePresence(opt.value);
                        setPresence(user.id, { status: opt.value, customStatus });
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
                  <div className="flex items-center gap-2">
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
                          const gw = getGatewayClient();
                          gw.updatePresence(status ?? 'online', [], statusDraft || undefined);
                          setPresence(user.id, { status: status ?? 'online', customStatus: statusDraft });
                          setEditingStatus(false);
                        }
                        if (e.key === 'Escape') {
                          setStatusDraft(customStatus);
                          setEditingStatus(false);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const gw = getGatewayClient();
                        gw.updatePresence(status ?? 'online', [], statusDraft || undefined);
                        setPresence(user.id, { status: status ?? 'online', customStatus: statusDraft });
                        setEditingStatus(false);
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--color-success-default)', color: '#fff' }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setStatusDraft(customStatus);
                        setEditingStatus(false);
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <p className="text-sm" style={{ color: customStatus ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                      {customStatus || 'No custom status set'}
                    </p>
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
          <Button variant="danger" size="sm">
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  );
}
