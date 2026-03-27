'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { setAccessToken } from '@/lib/api/client';
import { getCurrentUser, refreshTokens } from '@/lib/api/auth.api';
import { useGatewayBridge } from '@/hooks/useGatewayBridge';
import { useLiveKitRoom } from '@/hooks/useLiveKitRoom';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Wraps the authenticated portion of the app.
 * - Checks auth state on mount and redirects to /login if needed.
 * - Bootstraps the gateway connection via useGatewayBridge.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const isLoading = useAuthStore((s) => s.isLoading);
  const logoutAction = useAuthStore((s) => s.logout);

  const [ready, setReady] = useState(false);

  // Hydrate auth state from persisted store
  useEffect(() => {
    const hydrate = async () => {
      // Wait for zustand persist to hydrate
      await new Promise<void>((resolve) => {
        const unsub = useAuthStore.persist.onFinishHydration(() => {
          unsub();
          resolve();
        });
        // If already hydrated
        if (useAuthStore.persist.hasHydrated()) {
          unsub();
          resolve();
        }
      });

      const token = useAuthStore.getState().accessToken;

      if (!token) {
        // Silent restore: rely on HttpOnly refresh cookie.
        try {
          const refreshed = await refreshTokens();
          useAuthStore.getState().setTokens(refreshed.accessToken);
          setAccessToken(refreshed.accessToken);
        } catch {
          router.replace('/login');
          return;
        }
      } else {
        // Sync token to API client
        setAccessToken(token);
      }

      // If we don't have user data yet, fetch it
      if (!useAuthStore.getState().user) {
        setLoading(true);
        try {
          const userData = await getCurrentUser();
          setUser(userData);
        } catch {
          logoutAction();
          setAccessToken(null);
          router.replace('/login');
          return;
        } finally {
          setLoading(false);
        }
      }

      // Redirect unverified users to verify-email page
      const currentUser = useAuthStore.getState().user;
      if (currentUser && !currentUser.verified) {
        router.replace('/verify-email');
        return;
      }

      setReady(true);
    };

    hydrate();
  }, []);

  // Connect gateway
  useGatewayBridge();

  // Manage LiveKit room lifecycle (connects when voice credentials arrive)
  useLiveKitRoom();

  if (!ready || isLoading) {
    return (
      <div
        className="flex items-center justify-center h-screen w-screen"
        style={{ background: 'var(--color-surface-base)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <Spinner size={32} />
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Loading Swiip...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
