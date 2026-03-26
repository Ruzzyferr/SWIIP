'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Root app page — redirects to /channels/@me
 */
export default function AppRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/channels/@me');
  }, [router]);

  return null;
}
