'use client';

import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { FriendsList } from '@/components/friends/FriendsList';

export default function DMHomePage() {
  return (
    <>
      {/* DM sidebar (no guildId → shows DM list) */}
      <ChannelSidebar />

      {/* Main content — Friends list */}
      <FriendsList />
    </>
  );
}
