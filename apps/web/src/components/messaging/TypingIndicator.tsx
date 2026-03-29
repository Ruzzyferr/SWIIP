'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePresenceStore } from '@/stores/presence.store';
import { useAuthStore } from '@/stores/auth.store';
import { useGuildsStore } from '@/stores/guilds.store';

interface TypingIndicatorProps {
  channelId: string;
  guildId?: string;
}

function SoundWaveBars({ count = 5 }: { count?: number }) {
  return (
    <span className="flex items-end gap-[2px]" style={{ height: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="sound-wave-bar"
          style={{
            width: 2.5,
            height: 14,
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </span>
  );
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

  // More bars for more users typing
  const barCount = Math.min(typingUserIds.length + 4, 8);

  return (
    <AnimatePresence>
      <motion.div
        className="flex items-center gap-2.5 px-4 h-6 flex-shrink-0"
        style={{ color: 'var(--color-text-tertiary)' }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <SoundWaveBars count={barCount} />
        <span className="text-xs font-medium truncate">{text}</span>
      </motion.div>
    </AnimatePresence>
  );
}
