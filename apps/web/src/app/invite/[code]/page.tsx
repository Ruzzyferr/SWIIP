'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Users, Hash } from 'lucide-react';
import { resolveInvite, joinGuildByInvite } from '@/lib/api/guilds.api';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/ui/Avatar';
import { ApiError } from '@/lib/api/client';

interface InviteData {
  code: string;
  guild: {
    id: string;
    name: string;
    icon?: string;
    memberCount: number;
    description?: string;
  };
  channel: { id: string; name: string };
  inviter?: { id: string; username: string; globalName?: string };
  expiresAt?: string;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track whether the resolve failed due to auth so we can show a login prompt
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    if (!code) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await resolveInvite(code);
        if (!cancelled) setInvite(data);
      } catch (err) {
        if (cancelled) return;

        // If we got a 401 / auth error and the user isn't logged in, don't show
        // a hard error — instead show a prompt to log in.
        const is401 = err instanceof ApiError && err.statusCode === 401;
        if (is401 && !accessToken) {
          setAuthRequired(true);
        } else {
          setError(err instanceof Error ? err.message : 'Invalid or expired invite');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [code, accessToken]);

  const handleJoin = async () => {
    if (!accessToken) {
      router.push(`/login?redirect=${encodeURIComponent(`/invite/${code}`)}`);
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const guild = await joinGuildByInvite(code);
      router.push(`/channels/${guild.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join';
      if (msg.toLowerCase().includes('already')) {
        router.push(`/channels/${invite?.guild.id}`);
      } else {
        setError(msg);
      }
    } finally {
      setJoining(false);
    }
  };

  const handleLoginRedirect = () => {
    router.push(`/login?redirect=${encodeURIComponent(`/invite/${code}`)}`);
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-start py-8 px-3 sm:px-4 sm:justify-center sm:py-12 overflow-x-hidden"
      style={{ background: 'var(--color-surface-base)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[400px] mx-auto rounded-2xl p-6 sm:p-8 text-center"
        style={{
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-accent-primary)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Loading invite...</p>
          </div>
        ) : authRequired && !invite ? (
          /* User is not authenticated and the resolve endpoint requires auth */
          <div className="py-8">
            <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              You&apos;ve Been Invited
            </p>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-tertiary)' }}>
              Log in or create an account to accept this invite.
            </p>
            <button
              onClick={handleLoginRedirect}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-fast"
              style={{ background: 'var(--color-accent-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-accent-primary)';
              }}
            >
              Login to Accept
            </button>
          </div>
        ) : error && !invite ? (
          <div className="py-8">
            <p className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Invalid Invite
            </p>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-tertiary)' }}>
              {error}
            </p>
            <button
              onClick={() => router.push('/channels/@me')}
              className="px-6 py-2 rounded-lg text-sm font-medium"
              style={{
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-default)',
              }}
            >
              Go Home
            </button>
          </div>
        ) : invite ? (
          <>
            {invite.inviter && (
              <p className="text-xs mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
                <span style={{ color: 'var(--color-text-primary)' }}>
                  {invite.inviter.globalName || invite.inviter.username}
                </span>{' '}
                invited you to join
              </p>
            )}

            {/* Guild icon */}
            <div className="flex justify-center mb-4">
              {invite.guild.icon ? (
                <Avatar
                  src={invite.guild.icon}
                  userId={invite.guild.id}
                  displayName={invite.guild.name}
                  size="xl"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
                  style={{
                    background: 'var(--color-accent-primary)',
                    color: 'white',
                  }}
                >
                  {invite.guild.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <h2
              className="text-xl font-bold mb-1"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {invite.guild.name}
            </h2>

            {invite.guild.description && (
              <p className="text-sm mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                {invite.guild.description}
              </p>
            )}

            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                <Users size={13} />
                {invite.guild.memberCount} {invite.guild.memberCount === 1 ? 'member' : 'members'}
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                <Hash size={13} />
                {invite.channel.name}
              </div>
            </div>

            {error && (
              <p className="text-xs mb-3" style={{ color: 'var(--color-danger-default)' }}>
                {error}
              </p>
            )}

            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-fast"
              style={{
                background: joining ? 'var(--color-accent-hover)' : 'var(--color-accent-primary)',
              }}
              onMouseEnter={(e) => {
                if (!joining) e.currentTarget.style.background = 'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                if (!joining) e.currentTarget.style.background = 'var(--color-accent-primary)';
              }}
            >
              {joining ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Joining…
                </>
              ) : user ? (
                'Accept Invite'
              ) : (
                'Login to Accept'
              )}
            </button>
          </>
        ) : null}
      </motion.div>
    </div>
  );
}
