'use client';

import { useEffect, useState, useCallback } from 'react';
import { Hash, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { getWelcomeScreen, updateWelcomeScreen, type WelcomeScreen, type WelcomeScreenChannel } from '@/lib/api/guilds.api';
import { useGuildsStore } from '@/stores/guilds.store';
import { toastSuccess, toastError } from '@/lib/toast';

export function WelcomeScreenEditor({ guildId }: { guildId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [description, setDescription] = useState('');
  const [channels, setChannels] = useState<WelcomeScreenChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const guildChannels = useGuildsStore((s) => s.getGuildChannels(guildId));
  const textChannels = guildChannels.filter((c) => c.type === 'TEXT' || c.type === 0);

  const load = useCallback(async () => {
    try {
      const data = await getWelcomeScreen(guildId);
      setEnabled(data.enabled);
      setDescription(data.description ?? '');
      setChannels(data.channels ?? []);
    } catch {
      // leave defaults
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWelcomeScreen(guildId, {
        enabled,
        description: description.trim() || null,
        channels,
      });
      toastSuccess('Welcome screen saved!');
    } catch (err: any) {
      toastError(err?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addChannel = () => {
    if (textChannels.length === 0) return;
    const used = new Set(channels.map((c) => c.channelId));
    const available = textChannels.find((c) => !used.has(c.id));
    if (!available) return;
    setChannels([...channels, { channelId: available.id, description: '' }]);
  };

  const removeChannel = (idx: number) => {
    setChannels(channels.filter((_, i) => i !== idx));
  };

  const updateChannel = (idx: number, patch: Partial<WelcomeScreenChannel>) => {
    setChannels(channels.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-text-disabled)' }} />
      </div>
    );
  }

  const inputStyle = {
    background: 'var(--color-surface-base)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-default)',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Welcome Screen
        </h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium"
          style={{ background: 'var(--color-accent-primary)', color: '#fff', opacity: saving ? 0.6 : 1 }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
      </div>

      <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
        Show new members a welcome screen with a description and featured channels when they join.
      </p>

      {/* Enable toggle */}
      <div
        className="flex items-center justify-between p-4 rounded-lg"
        style={{ background: 'var(--color-surface-raised)' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Enable Welcome Screen
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            New members will see this when they first open the server.
          </p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className="w-11 h-6 rounded-full relative transition-colors"
          style={{ background: enabled ? 'var(--color-accent-primary)' : 'var(--color-border-default)' }}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
            style={{ left: enabled ? '22px' : '2px' }}
          />
        </button>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          Server Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Welcome to our server! Here's what you need to know..."
          rows={3}
          className="w-full px-3 py-2 rounded-md text-sm resize-none"
          style={inputStyle}
        />
      </div>

      {/* Featured Channels */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Featured Channels
          </label>
          <button
            onClick={addChannel}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded"
            style={{ color: 'var(--color-accent-primary)' }}
          >
            <Plus size={12} /> Add Channel
          </button>
        </div>

        {channels.length === 0 && (
          <p className="text-xs py-4 text-center" style={{ color: 'var(--color-text-disabled)' }}>
            No featured channels yet. Add channels to help new members get started.
          </p>
        )}

        <div className="space-y-2">
          {channels.map((ch, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-3 rounded-lg"
              style={{ background: 'var(--color-surface-raised)' }}
            >
              <Hash size={16} className="mt-2 flex-shrink-0" style={{ color: 'var(--color-text-disabled)' }} />
              <div className="flex-1 space-y-2">
                <select
                  value={ch.channelId}
                  onChange={(e) => updateChannel(idx, { channelId: e.target.value })}
                  className="w-full px-2 py-1.5 rounded text-sm"
                  style={inputStyle}
                >
                  {textChannels.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      # {tc.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={ch.description}
                  onChange={(e) => updateChannel(idx, { description: e.target.value })}
                  placeholder="What's this channel about?"
                  className="w-full px-2 py-1.5 rounded text-sm"
                  style={inputStyle}
                />
              </div>
              <button
                onClick={() => removeChannel(idx)}
                className="p-1 mt-1.5 flex-shrink-0"
                style={{ color: 'var(--color-text-disabled)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      {enabled && (
        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Preview
          </label>
          <div
            className="rounded-lg p-6 text-center"
            style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-subtle)' }}
          >
            <h4 className="text-base font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Welcome!
            </h4>
            {description && (
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                {description}
              </p>
            )}
            {channels.length > 0 && (
              <div className="flex flex-col gap-2 max-w-xs mx-auto">
                {channels.map((ch, idx) => {
                  const channel = textChannels.find((tc) => tc.id === ch.channelId);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-left"
                      style={{ background: 'var(--color-surface-base)' }}
                    >
                      <Hash size={14} style={{ color: 'var(--color-text-disabled)' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {channel?.name ?? 'unknown'}
                        </p>
                        {ch.description && (
                          <p className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                            {ch.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
