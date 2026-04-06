'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Volume2, Monitor, MessageSquare } from 'lucide-react';
import { getUserSettings, updateUserSettings, type UserSettings } from '@/lib/api/users.api';

function ToggleRow({
  icon: Icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: typeof Bell;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Icon
          size={18}
          className="mt-0.5 flex-shrink-0"
          style={{ color: 'var(--color-text-secondary)' }}
        />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {label}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {description}
          </p>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
        style={{
          background: value ? 'var(--color-accent-primary)' : 'var(--color-surface-overlay)',
          border: value ? 'none' : '1px solid var(--color-border-default)',
        }}
        role="switch"
        aria-checked={value}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: value ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </button>
    </div>
  );
}

const DEFAULTS: UserSettings = {
  desktopNotifications: true,
  notificationSounds: true,
  messageSounds: true,
  mentionEveryone: true,
  mentionRoles: true,
  flashTaskbar: true,
  badgeCount: true,
  muteAllServers: false,
};

export function NotificationsPage() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getUserSettings()
      .then((s) => {
        setSettings({ ...DEFAULTS, ...s });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    updateUserSettings(patch).catch(() => {});
  }, []);

  const desktopNotifs = settings.desktopNotifications ?? true;
  const sounds = settings.notificationSounds ?? true;
  const messageSounds = settings.messageSounds ?? true;
  const mentionEveryone = settings.mentionEveryone ?? true;
  const mentionRoles = settings.mentionRoles ?? true;
  const flashTaskbar = settings.flashTaskbar ?? true;
  const badgeCount = settings.badgeCount ?? true;
  const muteAllServers = settings.muteAllServers ?? false;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Notifications
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Configure how and when you want to be notified.
        </p>
      </div>

      {/* Desktop Notifications */}
      <section className="space-y-1">
        <p
          className="text-xs font-bold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          Desktop Notifications
        </p>
        <div
          className="p-4 rounded-xl space-y-1"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <ToggleRow
            icon={Monitor}
            label="Enable desktop notifications"
            description="Show notifications on your desktop when you receive a message."
            value={desktopNotifs}
            onChange={(v) => update({ desktopNotifications: v })}
          />

          <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

          <ToggleRow
            icon={Bell}
            label="Flash taskbar"
            description="Flash the app icon in the taskbar when you receive a notification."
            value={flashTaskbar}
            onChange={(v) => update({ flashTaskbar: v })}
          />

          <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

          <ToggleRow
            icon={MessageSquare}
            label="Unread message badge"
            description="Show unread message count badge on the app icon."
            value={badgeCount}
            onChange={(v) => update({ badgeCount: v })}
          />
        </div>
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Sounds */}
      <section className="space-y-1">
        <p
          className="text-xs font-bold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          Sounds
        </p>
        <div
          className="p-4 rounded-xl space-y-1"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <ToggleRow
            icon={Volume2}
            label="Notification sounds"
            description="Play a sound when you receive a notification."
            value={sounds}
            onChange={(v) => update({ notificationSounds: v })}
          />

          <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

          <ToggleRow
            icon={Volume2}
            label="Message sounds"
            description="Play a sound for every incoming message in focused channels."
            value={messageSounds}
            onChange={(v) => update({ messageSounds: v })}
          />
        </div>
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Mentions */}
      <section className="space-y-1">
        <p
          className="text-xs font-bold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          Mentions
        </p>
        <div
          className="p-4 rounded-xl space-y-1"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <ToggleRow
            icon={Bell}
            label="Suppress @everyone and @here"
            description="Prevent notifications from @everyone and @here mentions."
            value={!mentionEveryone}
            onChange={(v) => update({ mentionEveryone: !v })}
          />

          <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

          <ToggleRow
            icon={Bell}
            label="Suppress role mentions"
            description="Prevent notifications from role mentions."
            value={!mentionRoles}
            onChange={(v) => update({ mentionRoles: !v })}
          />
        </div>
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Server Overrides */}
      <section className="space-y-1">
        <p
          className="text-xs font-bold uppercase tracking-wider mb-3"
          style={{ color: 'var(--color-text-disabled)' }}
        >
          Server Notifications
        </p>
        <div
          className="p-4 rounded-xl"
          style={{ background: 'var(--color-surface-raised)' }}
        >
          <ToggleRow
            icon={BellOff}
            label="Mute all servers"
            description="Disable all server notifications. You will still see unread indicators."
            value={muteAllServers}
            onChange={(v) => update({ muteAllServers: v })}
          />
        </div>
        <p className="text-xs mt-2 px-1" style={{ color: 'var(--color-text-tertiary)' }}>
          You can also mute individual servers by right-clicking them in the server list.
        </p>
      </section>
    </div>
  );
}
