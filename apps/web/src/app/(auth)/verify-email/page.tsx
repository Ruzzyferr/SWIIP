'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { verifyEmailCode, resendVerificationCode } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { Spinner } from '@/components/ui/Spinner';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] },
  },
};

export default function VerifyEmailPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Wait for zustand persist hydration before making redirect decisions
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      unsub();
      setHydrated(true);
    });
    if (useAuthStore.persist.hasHydrated()) {
      unsub();
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace('/login');
    } else if (user.verified) {
      router.replace('/channels/@me');
    }
  }, [user, router, hydrated]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setError(null);
    setIsVerifying(true);
    try {
      await verifyEmailCode(code);
      updateUser({ verified: true });
      router.push('/channels/@me');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendVerificationCode();
      setResendCooldown(60);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    }
  };

  if (!hydrated || !user) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] w-full max-w-[100dvw]" style={{ background: 'var(--color-surface-base)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-start py-8 px-3 sm:px-4 sm:justify-center sm:py-10 overflow-x-hidden bg-surface-base">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)' }}
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[420px] mx-4"
      >
        <motion.div variants={itemVariants} className="text-center mb-7">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(16,185,129,0.15)' }}
          >
            <Mail size={28} style={{ color: 'var(--color-accent-primary)' }} />
          </div>
          <h1
            className="text-3xl font-bold"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
          >
            Verify your email
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Enter the 6-digit code sent to{' '}
            <span style={{ color: 'var(--color-text-primary)' }}>{user.email}</span>
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="rounded-2xl p-6"
          style={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 px-3 py-2.5 rounded-lg text-sm"
              style={{
                background: 'var(--color-danger-muted)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#fca5a5',
              }}
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="code"
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Verification code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-3 rounded-lg text-center text-2xl font-bold outline-none transition-all duration-fast"
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-primary)',
                  letterSpacing: '0.3em',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-focus)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-default)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && code.length === 6) handleVerify();
                }}
                placeholder="000000"
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={isVerifying || code.length !== 6}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-fast"
              style={{
                background: isVerifying || code.length !== 6
                  ? 'var(--color-accent-hover)'
                  : 'var(--color-accent-primary)',
                opacity: code.length !== 6 ? 0.5 : 1,
              }}
            >
              {isVerifying ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Verifying…
                </>
              ) : (
                'Verify email'
              )}
            </button>

            <div className="flex items-center justify-between">
              <button
                onClick={() => router.push('/login')}
                className="text-sm flex items-center gap-1 transition-colors duration-fast"
                style={{ color: 'var(--color-text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
              >
                <ArrowLeft size={14} />
                Back to login
              </button>
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-sm transition-colors duration-fast"
                style={{
                  color: resendCooldown > 0 ? 'var(--color-text-muted)' : 'var(--color-text-accent)',
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
