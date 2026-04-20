'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createThread } from '@/lib/api/channels.api';
import { sendMessage } from '@/lib/api/messages.api';
import { useUIStore } from '@/stores/ui.store';
import { toastError, toastSuccess } from '@/lib/toast';

export function CreateThreadModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const activeModal = useUIStore((s) => s.activeModal);
  const openThread = useUIStore((s) => s.openThread);

  const channelId = (activeModal?.props?.channelId as string) ?? '';
  const parentMessageId = (activeModal?.props?.parentMessageId as string) ?? '';
  const parentPreview = activeModal?.props?.parentPreview as string | undefined;

  const [name, setName] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Thread name is required');
      return;
    }
    if (trimmedName.length > 100) {
      setError('Thread name must be 100 characters or fewer');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const thread = await createThread(channelId, trimmedName, parentMessageId);
      const threadChannelId = thread.channel?.id;

      const firstMsg = firstMessage.trim();
      if (firstMsg && threadChannelId) {
        try {
          await sendMessage(threadChannelId, { content: firstMsg });
        } catch {
          // Thread was created; failing to post the seed message isn't fatal.
          toastError('Thread created, but the first message could not be posted.');
        }
      }

      if (threadChannelId) {
        openThread(threadChannelId);
      }
      closeModal();
      toastSuccess(`Thread "${trimmedName}" created`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create thread';
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--color-accent-subtle)',
              color: 'var(--color-accent-primary)',
            }}
          >
            <MessageSquare size={16} />
          </div>
          <h3
            className="text-xl"
            style={{
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-display)',
              fontFeatureSettings: '"opsz" auto',
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            Start a thread
          </h3>
        </div>
        <p
          className="text-sm"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          Branch the conversation without losing the main thread.
        </p>
      </div>

      {/* Parent message preview (if any) */}
      {parentPreview && (
        <div
          className="rounded-md px-3 py-2 border-l-2"
          style={{
            background: 'var(--color-surface-raised)',
            borderLeftColor: 'var(--color-accent-primary)',
          }}
        >
          <p
            className="text-[11px] uppercase tracking-wider font-semibold mb-0.5"
            style={{
              color: 'var(--color-text-tertiary)',
              letterSpacing: '0.12em',
            }}
          >
            Replying to
          </p>
          <p
            className="text-sm truncate"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {parentPreview}
          </p>
        </div>
      )}

      {/* Thread name */}
      <Input
        label="Thread name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        placeholder="e.g. design review — april"
        error={error || undefined}
        maxLength={100}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) handleCreate();
        }}
      />

      {/* First message (optional) */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="thread-first-message"
          className="block text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.12em' }}
        >
          First message
          <span
            className="ml-2 italic normal-case tracking-normal"
            style={{
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-display)',
              fontFeatureSettings: '"opsz" auto',
              fontWeight: 400,
              letterSpacing: '-0.005em',
            }}
          >
            optional
          </span>
        </label>
        <textarea
          id="thread-first-message"
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          placeholder="Kick off the discussion…"
          rows={3}
          className="w-full rounded-lg px-3 py-2.5 text-sm resize-none outline-none transition-colors duration-fast"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border-default)',
            color: 'var(--color-text-primary)',
            lineHeight: 1.5,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-focus)';
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-accent-subtle)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-default)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-1">
        <button
          onClick={closeModal}
          disabled={loading}
          className="text-sm font-medium transition-colors duration-fast disabled:opacity-50"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          Cancel
        </button>
        <Button
          onClick={handleCreate}
          loading={loading}
          disabled={!name.trim()}
        >
          Create thread
        </Button>
      </div>
    </div>
  );
}
