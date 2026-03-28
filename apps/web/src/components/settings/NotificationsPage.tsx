'use client';

import { useState } from 'react';
import { Bell, BellOff, Volume2, Monitor, MessageSquare } from 'lucide-react';

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

export function NotificationsPage() {
  const [desktopNotifs, setDesktopNotifs] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [messageSounds, setMessageSounds] = useState(true);
  const [mentionEveryone, setMentionEveryone] = useState(true);
  const [mentionRoles, setMentionRoles] = useState(true);
  const [flashTaskbar, setFlashTaskbar] = useState(true);
  const [badgeCount, setBadgeCount] = useState(true);
  const [muteAllServers, setMuteAllServers] = useState(false);

  return (
    <div className="max-w-2xl space-y-8">
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
            onChange={setDesktopNotifs}
          />

          <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

          <ToggleRow
            icon={Bell}
            label="Flash taskbar"
            description="Flash the app icon in the taskbar when you receive a notification."
            value={flashTaskbar}
            onChange={setFlashTaskbar}
          />

          <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

          <ToggleRow
            icon={MessageSquare}
            label="Unread message badge"
            description="Show unread message count badge on the app icon."
            value={badgeCount}
            onChange={setBadgeCount}
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
            onChange={setSounds}
          />

          <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

          <ToggleRow
            icon={Volume2}
            label="Message sounds"
            description="Play a sound for every incoming message in focused channels."
            value={messageSounds}
            onChange={setMessageSounds}
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
            onChange={(v) => setMentionEveryone(!v)}
          />

          <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

          <ToggleRow
            icon={Bell}
            label="Suppress role mentions"
            description="Prevent notifications from role mentions."
            value={!mentionRoles}
            onChange={(v) => setMentionRoles(!v)}
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
            onChange={setMuteAllServers}
          />
        </div>
        <p className="text-xs mt-2 px-1" style={{ color: 'var(--color-text-tertiary)' }}>
          You can also mute individual servers by right-clicking them in the server list.
        </p>
      </section>
    </div>
  );
}
