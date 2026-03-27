'use client';

import { useEffect, useState } from 'react';
import { ChannelSidebar } from '@/components/layout/ChannelSidebar';
import { FriendsList } from '@/components/friends/FriendsList';
import { useUIStore } from '@/stores/ui.store';

export default function DMHomePage() {
  const isMobileNavOpen = useUIStore((s) => s.isMobileNavOpen);
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  // On mobile, show DM list by default (not empty friends view)
  useEffect(() => {
    if (isMobile) {
      setMobileNavOpen(true);
    }
  }, [isMobile, setMobileNavOpen]);

  // On mobile: show sidebar OR content, not both
  if (isMobile) {
    return isMobileNavOpen ? <ChannelSidebar /> : <FriendsList />;
  }

  return (
    <>
      <ChannelSidebar />
      <FriendsList />
    </>
  );
}
