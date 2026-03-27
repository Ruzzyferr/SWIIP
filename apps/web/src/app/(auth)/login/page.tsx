'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Github, Chrome } from 'lucide-react';
import { login } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { setAccessToken } from '@/lib/api/client';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const setUser = useAuthStore((s) => s.setUser);
  const setTokens = useAuthStore((s) => s.setTokens);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const res = await login({ email: data.email, password: data.password });
      setUser(res.user);
      setTokens(res.tokens.accessToken, res.sessionId);
      setAccessToken(res.tokens.accessToken);
      router.push(redirectTo || '/channels/@me');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid email or password';
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
        {/* Radial glow top-left */}
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          }}
        />
        {/* Radial glow bottom-right */}
        <div
          className="absolute -bottom-48 -right-48 w-[700px] h-[700px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
          }}
        />
        {/* Grid pattern */}
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

      {/* Auth card */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[400px] mx-4"
      >
        {/* Logo */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-accent-primary)' }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 6C4 4.895 4.895 4 6 4H14C15.105 4 16 4.895 16 6V11C16 12.105 15.105 13 14 13H11L8 16V13H6C4.895 13 4 12.105 4 11V6Z"
                  fill="white"
                />
              </svg>
            </div>
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Swiip
            </span>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
          >
            Welcome back
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Sign in to continue to your workspace
          </p>
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
          {/* Server error */}
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
            {/* Email */}
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

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs transition-colors duration-fast"
                  style={{ color: 'var(--color-text-accent)' }}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none transition-all duration-fast"
                  style={{
                    background: 'var(--color-surface-raised)',
                    border: errors.password
                      ? '1px solid var(--color-danger-default)'
                      : '1px solid var(--color-border-default)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = errors.password
                      ? 'var(--color-danger-default)'
                      : 'var(--color-border-focus)';
                    e.currentTarget.style.boxShadow = errors.password
                      ? '0 0 0 3px rgba(239,68,68,0.15)'
                      : '0 0 0 3px rgba(99,102,241,0.15)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = errors.password
                      ? 'var(--color-danger-default)'
                      : 'var(--color-border-default)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded transition-colors duration-fast"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff size={15} />
                  ) : (
                    <Eye size={15} />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-danger-default)' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
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
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
              or continue with
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-fast"
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
              <Github size={15} />
              GitHub
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-fast"
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
              <Chrome size={15} />
              Google
            </button>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          variants={itemVariants}
          className="text-center mt-5 text-sm"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-medium transition-colors duration-fast"
            style={{ color: 'var(--color-text-accent)' }}
          >
            Sign up
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
