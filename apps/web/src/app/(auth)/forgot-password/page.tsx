'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { forgotPassword } from '@/lib/api/auth.api';

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

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

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotFormData) => {
    setServerError(null);
    try {
      await forgotPassword(data.email);
      setSent(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setServerError(message);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-surface-base">
      {/* Background geometric decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-48 -right-48 w-[700px] h-[700px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
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
              width={48}
              height={48}
              className="rounded-xl"
            />
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Swiip
            </span>
          </div>

          {sent ? (
            <>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(34,197,94,0.12)' }}
              >
                <CheckCircle2 size={28} style={{ color: 'var(--color-success-default, #22c55e)' }} />
              </div>
              <h1
                className="text-3xl font-bold tracking-tight"
                style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
              >
                Check your email
              </h1>
              <p
                className="mt-2 text-sm"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                If an account exists for{' '}
                <span style={{ color: 'var(--color-text-primary)' }}>
                  {getValues('email')}
                </span>
                , we&apos;ve sent a password reset link.
              </p>
            </>
          ) : (
            <>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'var(--color-accent-muted, rgba(99,102,241,0.15))' }}
              >
                <Mail size={28} style={{ color: 'var(--color-accent-primary)' }} />
              </div>
              <h1
                className="text-3xl font-bold tracking-tight"
                style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
              >
                Reset your password
              </h1>
              <p
                className="mt-2 text-sm"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Enter the email address associated with your account
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
          {sent ? (
            <div className="space-y-4">
              <p
                className="text-sm text-center"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Didn&apos;t receive the email? Check your spam folder or try again with a different email address.
              </p>
              <button
                onClick={() => setSent(false)}
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-fast flex items-center justify-center gap-2"
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border-default)',
                  color: 'var(--color-text-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-default)';
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
              >
                Try a different email
              </button>
            </div>
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

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    {...register('email')}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-fast"
                    style={{
                      background: 'var(--color-surface-raised)',
                      border: errors.email
                        ? '1px solid var(--color-danger-default)'
                        : '1px solid var(--color-border-default)',
                      color: 'var(--color-text-primary)',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = errors.email
                        ? 'var(--color-danger-default)'
                        : 'var(--color-border-focus)';
                      e.currentTarget.style.boxShadow = errors.email
                        ? '0 0 0 3px rgba(239,68,68,0.15)'
                        : '0 0 0 3px rgba(99,102,241,0.15)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = errors.email
                        ? 'var(--color-danger-default)'
                        : 'var(--color-border-default)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    placeholder="you@example.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-danger-default)' }}>
                      {errors.email.message}
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
                      e.currentTarget.style.background = 'var(--color-accent-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmitting)
                      e.currentTarget.style.background = 'var(--color-accent-primary)';
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>
            </>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          variants={itemVariants}
          className="text-center mt-5"
        >
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
