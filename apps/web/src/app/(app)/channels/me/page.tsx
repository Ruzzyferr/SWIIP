'use client';

import { useEffect } from 'react';
import { FriendsList } from '@/components/friends/FriendsList';
import { useUIStore } from '@/stores/ui.store';

export default function DMHomePage() {
  const setActiveGuild = useUIStore((s) => s.setActiveGuild);

  useEffect(() => {
    setActiveGuild(null);
  }, [setActiveGuild]);

  return <FriendsList />;
}
