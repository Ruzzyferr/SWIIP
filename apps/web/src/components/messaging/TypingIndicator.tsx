'use client';

import { usePresenceStore } from '@/stores/presence.store';
import { useAuthStore } from '@/stores/auth.store';
import { useGuildsStore } from '@/stores/guilds.store';

interface TypingIndicatorProps {
  channelId: string;
  guildId?: string;
}

export function TypingIndicator({ channelId, guildId }: TypingIndicatorProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const getTypingUsers = usePresenceStore((s) => s.getTypingUsers);
  const members = useGuildsStore((s) => (guildId ? s.members[guildId] : null));

  const typingUserIds = getTypingUsers(channelId).filter(
    (uid) => uid !== currentUserId
  );

  if (typingUserIds.length === 0) return null;

  const getName = (userId: string): string => {
    if (members) {
      const member = members[userId];
      return member?.nick ?? member?.user?.globalName ?? member?.user?.username ?? userId;
    }
    return userId;
  };

  let text: string;
  if (typingUserIds.length === 1) {
    text = `${getName(typingUserIds[0]!)} is typing`;
  } else if (typingUserIds.length === 2) {
    text = `${getName(typingUserIds[0]!)} and ${getName(typingUserIds[1]!)} are typing`;
  } else if (typingUserIds.length === 3) {
    text = `${getName(typingUserIds[0]!)}, ${getName(typingUserIds[1]!)}, and ${getName(typingUserIds[2]!)} are typing`;
  } else {
    text = 'Several people are typing';
  }

  return (
    <div
      className="flex items-center gap-2 px-4 h-6 flex-shrink-0"
      style={{ color: 'var(--color-text-tertiary)' }}
    >
      {/* Animated dots */}
      <span className="flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'var(--color-text-tertiary)',
              animation: `typing-bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </span>
      <span className="text-xs font-medium truncate">{text}</span>
    </div>
  );
}
