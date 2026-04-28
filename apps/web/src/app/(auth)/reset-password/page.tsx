'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { resetPassword } from '@/lib/api/auth.api';

const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetFormData = z.infer<typeof resetSchema>;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: ResetFormData) => {
    if (!token) return;
    setServerError(null);
    try {
      await resetPassword(token, data.newPassword);
      setDone(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Could not reset password. The link may have expired.';
      setServerError(message);
    }
  };

  const tokenMissing = !token;

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-start py-8 px-3 sm:px-4 sm:justify-center sm:py-10 overflow-x-hidden bg-surface-base">
      {/* Background geometric decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-48 -right-48 w-[700px] h-[700px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
          }}
        />
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.025]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="white"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[400px] mx-4"
      >
        {/* Logo */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <Image
              src="/logo.png"
              alt="Swiip"
              width={72}
              height={72}
              className="rounded-xl"
            />
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Swiip
            </span>
          </div>

          {done ? (
            <>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(34,197,94,0.12)' }}
              >
                <CheckCircle2
                  size={28}
                  style={{ color: 'var(--color-success-default, #22c55e)' }}
                />
              </div>
              <h1
                className="text-3xl font-bold tracking-tight"
                style={{
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.03em',
                }}
              >
                Password updated
              </h1>
              <p
                className="mt-2 text-sm"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Your password has been reset. You can now sign in with your new
                password.
              </p>
            </>
          ) : tokenMissing ? (
            <>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'var(--color-danger-muted)' }}
              >
                <ShieldAlert
                  size={28}
                  style={{ color: 'var(--color-danger-default)' }}
                />
              </div>
              <h1
                className="text-3xl font-bold tracking-tight"
                style={{
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.03em',
                }}
              >
                Invalid reset link
              </h1>
              <p
                className="mt-2 text-sm"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                This link is missing a token or has been malformed. Request a
                new password reset email to continue.
              </p>
            </>
          ) : (
            <>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{
                  background:
                    'var(--color-accent-muted, rgba(16,185,129,0.15))',
                }}
              >
                <KeyRound
                  size={28}
                  style={{ color: 'var(--color-accent-primary)' }}
                />
              </div>
              <h1
                className="text-3xl font-bold tracking-tight"
                style={{
                  color: 'var(--color-text-primary)',
                  letterSpacing: '-0.03em',
                }}
              >
                Set a new password
              </h1>
              <p
                className="mt-2 text-sm"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Enter a new password for your account.
              </p>
            </>
          )}
        </motion.div>

        {/* Form card */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl p-6"
          style={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          {done ? (
            <Link
              href="/login"
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-fast flex items-center justify-center gap-2"
              style={{ background: 'var(--color-accent-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  'var(--color-accent-primary)';
              }}
            >
              Sign in
            </Link>
          ) : tokenMissing ? (
            <Link
              href="/forgot-password"
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-fast flex items-center justify-center gap-2"
              style={{ background: 'var(--color-accent-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  'var(--color-accent-primary)';
              }}
            >
              Request a new link
            </Link>
          ) : (
            <>
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-4 px-3 py-2.5 rounded-lg text-sm"
                  style={{
                    background: 'var(--color-danger-muted)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#fca5a5',
                  }}
                >
                  {serverError}
                </motion.div>
              )}

              <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      autoFocus
                      {...register('newPassword')}
                      className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none transition-all duration-fast"
                      style={{
                        background: 'var(--color-surface-raised)',
                        border: errors.newPassword
                          ? '1px solid var(--color-danger-default)'
                          : '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = errors.newPassword
                          ? 'var(--color-danger-default)'
                          : 'var(--color-border-focus)';
                        e.currentTarget.style.boxShadow = errors.newPassword
                          ? '0 0 0 3px rgba(239,68,68,0.15)'
                          : '0 0 0 3px rgba(16,185,129,0.15)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = errors.newPassword
                          ? 'var(--color-danger-default)'
                          : 'var(--color-border-default)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded transition-colors duration-fast"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      tabIndex={-1}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={15} />
                      ) : (
                        <Eye size={15} />
                      )}
                    </button>
                  </div>
                  {errors.newPassword && (
                    <p
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-danger-default)' }}
                    >
                      {errors.newPassword.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      {...register('confirmPassword')}
                      className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none transition-all duration-fast"
                      style={{
                        background: 'var(--color-surface-raised)',
                        border: errors.confirmPassword
                          ? '1px solid var(--color-danger-default)'
                          : '1px solid var(--color-border-default)',
                        color: 'var(--color-text-primary)',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor =
                          errors.confirmPassword
                            ? 'var(--color-danger-default)'
                            : 'var(--color-border-focus)';
                        e.currentTarget.style.boxShadow =
                          errors.confirmPassword
                            ? '0 0 0 3px rgba(239,68,68,0.15)'
                            : '0 0 0 3px rgba(16,185,129,0.15)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor =
                          errors.confirmPassword
                            ? 'var(--color-danger-default)'
                            : 'var(--color-border-default)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      placeholder="Re-enter your new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded transition-colors duration-fast"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      tabIndex={-1}
                      aria-label={
                        showConfirm ? 'Hide password' : 'Show password'
                      }
                    >
                      {showConfirm ? (
                        <EyeOff size={15} />
                      ) : (
                        <Eye size={15} />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-danger-default)' }}
                    >
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-fast mt-2 flex items-center justify-center gap-2"
                  style={{
                    background: isSubmitting
                      ? 'var(--color-accent-hover)'
                      : 'var(--color-accent-primary)',
                    opacity: isSubmitting ? 0.8 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting)
                      e.currentTarget.style.background =
                        'var(--color-accent-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmitting)
                      e.currentTarget.style.background =
                        'var(--color-accent-primary)';
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Updating…
                    </>
                  ) : (
                    'Reset password'
                  )}
                </button>
              </form>
            </>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div variants={itemVariants} className="text-center mt-5">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm transition-colors duration-fast"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <ArrowLeft size={14} />
            Back to sign in
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
