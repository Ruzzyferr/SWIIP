'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Phone, Video, UserPlus, Menu, PhoneCall } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { useDMsStore } from '@/stores/dms.store';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { useUIStore } from '@/stores/ui.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useVoiceActions } from '@/hooks/useVoiceActions';
import { editMessage as editMessageApi } from '@/lib/api/messages.api';
import { getDMChannel } from '@/lib/api/dms.api';
import { ChannelType, type MessagePayload } from '@constchat/protocol';

interface DMChatViewProps {
  conversationId: string;
}

export function DMChatView({ conversationId }: DMChatViewProps) {
  const conversations = useDMsStore((s) => s.conversations);
  const addConversation = useDMsStore((s) => s.addConversation);
  const currentUser = useAuthStore((s) => s.user);
  const setActiveDM = useUIStore((s) => s.setActiveDM);
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav);
  const updateMessage = useMessagesStore((s) => s.updateMessage);
  const presences = usePresenceStore((s) => s.users);

  const { joinVoiceChannel, leaveVoiceChannel, toggleCamera } = useVoiceActions();
  const isInCall = useVoiceStore((s) => s.currentChannelId === conversationId);
  const getChannelParticipants = useVoiceStore((s) => s.getChannelParticipants);
  const channelParticipants = getChannelParticipants(conversationId);
  const hasActiveCall = channelParticipants.length > 0;

  const [replyTo, setReplyTo] = useState<MessagePayload | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessagePayload | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const callStartRef = useRef<number | null>(null);

  const dm = conversations[conversationId];

  // Fetch DM if not in store
  useEffect(() => {
    if (!dm && !fetchError) {
      getDMChannel(conversationId)
        .then(addConversation)
        .catch((err) => {
          console.error(err);
          setFetchError(err?.message ?? 'Failed to load conversation');
        });
    }
  }, [conversationId, dm, addConversation, fetchError]);

  // Reset error state when conversation changes
  useEffect(() => {
    setFetchError(null);
  }, [conversationId]);

  // Call duration timer
  useEffect(() => {
    if (isInCall) {
      callStartRef.current = Date.now();
      setCallDuration(0);
      const interval = setInterval(() => {
        if (callStartRef.current) {
          setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      callStartRef.current = null;
      setCallDuration(0);
    }
  }, [isInCall]);

  // Sync active DM
  useEffect(() => {
    setActiveDM(conversationId);
  }, [conversationId, setActiveDM]);

  const otherUser = useMemo(() => {
    if (!dm) return null;
    return dm.recipients?.find((r) => r.id !== currentUser?.id) ?? dm.recipients?.[0] ?? null;
  }, [dm, currentUser?.id]);

  const isGroup = dm?.type === ChannelType.GROUP_DM;
  const displayName = isGroup
    ? (dm?.name ?? dm?.recipients?.map((r) => r.globalName ?? r.username).join(', ') ?? 'Group')
    : (otherUser?.globalName ?? otherUser?.username ?? 'Unknown');

  const status = otherUser && !isGroup
    ? (presences[otherUser.id]?.status ?? 'offline')
    : null;

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleReply = useCallback((message: MessagePayload) => {
    setReplyTo(message);
    setEditingMessage(null);
  }, []);

  const handleEditSubmit = useCallback(
    async (messageId: string, content: string) => {
      const updated = await editMessageApi(conversationId, messageId, { content });
      updateMessage(conversationId, messageId, updated);
    },
    [conversationId, updateMessage]
  );

  return (
    <div
      className="flex-1 flex flex-col min-w-0"
      style={{ background: 'var(--color-surface-base)' }}
    >
      {/* DM Header */}
      <div
        className="flex items-center justify-between px-4 h-12 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile hamburger */}
          <button
            onClick={toggleMobileNav}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-fast md:hidden"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Open channels menu"
          >
            <Menu size={18} />
          </button>
          {otherUser && !isGroup && (
            <Avatar
              src={otherUser.avatar}
              displayName={displayName}
              size="sm"
              status={status as any}
            />
          )}
          <span
            className="truncate"
            style={{
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-display)',
              fontFeatureSettings: '"opsz" auto',
              fontSize: '15px',
              fontWeight: 500,
              letterSpacing: '-0.005em',
            }}
          >
            {displayName}
          </span>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
          <Tooltip content={isInCall ? 'Leave Call' : 'Start Voice Call'} placement="bottom">
            <button
              className="p-1.5 sm:p-2 rounded-md transition-colors"
              aria-label={isInCall ? 'Leave call' : 'Start voice call'}
              style={isInCall ? { color: 'var(--color-danger-default)' } : undefined}
              onClick={() => {
                if (isInCall) {
                  leaveVoiceChannel();
                } else {
                  joinVoiceChannel(conversationId, true);
                }
              }}
            >
              <Phone size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </Tooltip>
          <Tooltip content="Start Video Call" placement="bottom">
            <button
              className="p-1.5 sm:p-2 rounded-md transition-colors"
              aria-label="Start video call"
              onClick={() => {
                if (!isInCall) {
                  joinVoiceChannel(conversationId, true);
                }
                // Small delay to let the connection establish before enabling camera
                setTimeout(() => toggleCamera(), 500);
              }}
            >
              <Video size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </Tooltip>
          {isGroup && (
            <Tooltip content="Add Members" placement="bottom">
              <button className="p-1.5 sm:p-2 rounded-md transition-colors" aria-label="Add members">
                <UserPlus size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Active call banner */}
      {hasActiveCall && (
        <div
          className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{
            background: isInCall ? 'var(--color-success-muted)' : 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border-subtle)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-success-default)' }}
            >
              <PhoneCall size={16} style={{ color: 'white' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {isInCall ? 'Voice call in progress' : 'Voice call started'}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {channelParticipants.length} participant{channelParticipants.length !== 1 ? 's' : ''}
                {isInCall && ` · ${formatDuration(callDuration)}`}
              </p>
            </div>
          </div>
          <button
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{
              background: isInCall ? 'var(--color-danger-default)' : 'var(--color-success-default)',
              color: 'white',
            }}
            onClick={() => {
              if (isInCall) {
                leaveVoiceChannel();
              } else {
                joinVoiceChannel(conversationId, true);
              }
            }}
          >
            {isInCall ? 'Leave' : 'Join Call'}
          </button>
        </div>
      )}

      {/* Messages + composer */}
      <div className="flex-1 flex flex-col min-h-0">
        <MessageList
          channelId={conversationId}
          onReply={handleReply}
        />

        <TypingIndicator channelId={conversationId} />

        <MessageComposer
          channelId={conversationId}
          channelName={displayName}
          replyTo={replyTo}
          editingMessage={editingMessage}
          onClearReply={() => setReplyTo(null)}
          onClearEdit={() => setEditingMessage(null)}
          onEditSubmit={handleEditSubmit}
          onStartEdit={setEditingMessage}
        />
      </div>
    </div>
  );
}
