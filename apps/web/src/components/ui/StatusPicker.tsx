'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Circle, Moon, MinusCircle, EyeOff, Smile, X, Check } from 'lucide-react';
import type { PresenceStatus } from '@constchat/protocol';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { updateUserStatus, CLEAR_AFTER_OPTIONS, scheduleStatusClear, checkPendingStatusClear } from '@/lib/presence';

const STATUS_OPTIONS: Array<{
  value: PresenceStatus;
  label: string;
  description?: string;
  color: string;
  icon: typeof Circle;
}> = [
  { value: 'online', label: 'Online', color: '#23a55a', icon: Circle },
  { value: 'idle', label: 'Idle', color: '#f0b232', icon: Moon },
  { value: 'dnd', label: 'Do Not Disturb', description: 'Notifications will be muted', color: '#f23f43', icon: MinusCircle },
  { value: 'invisible', label: 'Invisible', description: 'You will appear offline', color: '#80848e', icon: EyeOff },
];

interface StatusPickerProps {
  onClose: () => void;
}

export function StatusPicker({ onClose }: StatusPickerProps) {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';
  const currentStatus = usePresenceStore((s) => userId ? s.users[userId]?.status ?? 'online' : 'online');
  const currentCustom = usePresenceStore((s) => userId ? s.users[userId]?.customStatus : undefined);

  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [customDraft, setCustomDraft] = useState(currentCustom ?? '');
  const [emojiDraft, setEmojiDraft] = useState('');
  const [clearAfter, setClearAfter] = useState(0);

  const ref = useRef<HTMLDivElement>(null);

  // Check pending clear on mount
  useEffect(() => {
    checkPendingStatusClear();
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleStatusChange = (status: PresenceStatus) => {
    updateUserStatus(userId, status, currentCustom);
    if (!showCustomEditor) onClose();
  };

  const handleCustomSave = () => {
    const text = emojiDraft
      ? `${emojiDraft} ${customDraft}`.trim()
      : customDraft.trim();
    updateUserStatus(userId, currentStatus, text || undefined);
    scheduleStatusClear(userId, currentStatus, clearAfter);
    setShowCustomEditor(false);
    onClose();
  };

  const handleCustomClear = () => {
    updateUserStatus(userId, currentStatus, undefined);
    setCustomDraft('');
    setEmojiDraft('');
    scheduleStatusClear(userId, currentStatus, 0);
    setShowCustomEditor(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="absolute bottom-full left-0 mb-2 w-72 rounded-xl overflow-hidden z-50"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Status Options */}
        <div className="p-1.5">
          {STATUS_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = currentStatus === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
                style={{
                  background: isActive ? 'var(--color-surface-overlay)' : 'transparent',
                  color: 'var(--color-text-primary)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--color-surface-overlay)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                  <Icon
                    size={opt.value === 'dnd' ? 16 : 14}
                    fill={opt.color}
                    color={opt.value === 'dnd' ? '#fff' : opt.color}
                    strokeWidth={opt.value === 'dnd' ? 0 : 0}
                    style={opt.value !== 'dnd' ? { fill: opt.color, stroke: 'none' } : { color: opt.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{opt.label}</p>
                  {opt.description && (
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      {opt.description}
                    </p>
                  )}
                </div>
                {isActive && (
                  <Check size={14} style={{ color: 'var(--color-success-default)' }} />
                )}
              </button>
            );
          })}
        </div>

        <div className="mx-3 h-px" style={{ background: 'var(--color-border-subtle)' }} />

        {/* Custom Status */}
        <div className="p-1.5">
          {!showCustomEditor ? (
            <button
              onClick={() => {
                setCustomDraft(currentCustom ?? '');
                setShowCustomEditor(true);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-overlay)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Smile size={16} style={{ color: 'var(--color-text-secondary)' }} />
              <div className="flex-1 min-w-0">
                {currentCustom ? (
                  <>
                    <p className="text-sm truncate">{currentCustom}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Edit custom status</p>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Set a custom status</p>
                )}
              </div>
              {currentCustom && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCustomClear();
                  }}
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
                >
                  <X size={12} />
                </button>
              )}
            </button>
          ) : (
            <div className="px-2 py-2 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide px-1" style={{ color: 'var(--color-text-disabled)' }}>
                Custom Status
              </p>

              {/* Emoji + Text input */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Simple emoji toggle — cycle through common status emojis
                    const emojis = ['', '\u{1F3AE}', '\u{1F3B5}', '\u{1F4BB}', '\u{2615}', '\u{1F4DA}', '\u{1F3AC}', '\u{1F6CC}', '\u{1F3C3}'];
                    const idx = emojis.indexOf(emojiDraft);
                    setEmojiDraft(emojis[(idx + 1) % emojis.length]!);
                  }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{
                    background: 'var(--color-surface-base)',
                    border: '1px solid var(--color-border-default)',
                  }}
                  title="Click to pick emoji"
                >
                  {emojiDraft || <Smile size={16} style={{ color: 'var(--color-text-tertiary)' }} />}
                </button>
                <input
                  type="text"
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
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
                    if (e.key === 'Enter') handleCustomSave();
                    if (e.key === 'Escape') setShowCustomEditor(false);
                  }}
                />
              </div>

              {/* Clear after */}
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Clear after:</span>
                <select
                  value={clearAfter}
                  onChange={(e) => setClearAfter(Number(e.target.value))}
                  className="text-xs rounded px-2 py-1 outline-none"
                  style={{
                    color: 'var(--color-text-primary)',
                    background: 'var(--color-surface-base)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  {CLEAR_AFTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2">
                <button
                  onClick={handleCustomSave}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--color-brand-default)',
                    color: '#fff',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setShowCustomEditor(false)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--color-surface-overlay)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
