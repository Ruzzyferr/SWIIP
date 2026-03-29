'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Eye, EyeOff, Loader2, Github, Chrome } from 'lucide-react';
import { login } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { setAccessToken } from '@/lib/api/client';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('auth.login');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const redirectTo = rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : null;
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

      // Redirect unverified users to verification page
      if (!res.user.verified) {
        router.push('/verify-email');
      } else {
        router.push(redirectTo || '/channels/@me');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid email or password';
      setServerError(message);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: 'var(--color-surface-base)' }}>
      {/* Atmospheric background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #6c5ce7, transparent 65%)' }}
        />
        <div
          className="absolute -bottom-48 -right-48 w-[700px] h-[700px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #a29bfe, transparent 65%)' }}
        />
        <div
          className="absolute top-[40%] right-[20%] w-[400px] h-[400px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #fd79a8, transparent 65%)' }}
        />
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
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 mb-6 transition-opacity hover:opacity-80"
          >
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
          </Link>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
          >
            {t('title')}
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Form card */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl p-6"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: 'var(--shadow-float)',
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
                {t('email')}
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
                  {t('password')}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs transition-colors duration-fast"
                  style={{ color: 'var(--color-text-accent)' }}
                >
                  {t('forgotPassword')}
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
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
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
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all mt-2 flex items-center justify-center gap-2"
              style={{
                background: isSubmitting
                  ? 'var(--color-accent-hover)'
                  : 'var(--color-accent-gradient)',
                opacity: isSubmitting ? 0.8 : 1,
                boxShadow: isSubmitting ? 'none' : '0 4px 15px rgba(108,92,231,0.3)',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(108,92,231,0.45)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(108,92,231,0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                t('submit')
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
            <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
              {t('continueWith')}
            </span>
            <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
          </div>

          {/* Social buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-secondary)',
              }}
              title="Coming soon"
            >
              <Github size={15} />
              GitHub
              <span className="text-xs">({tCommon('comingSoon')})</span>
            </button>
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-secondary)',
              }}
              title="Coming soon"
            >
              <Chrome size={15} />
              Google
              <span className="text-xs">({tCommon('comingSoon')})</span>
            </button>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          variants={itemVariants}
          className="text-center mt-5 text-sm"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {t('noAccount')}{' '}
          <Link
            href="/register"
            className="font-medium transition-colors duration-fast"
            style={{ color: 'var(--color-text-accent)' }}
          >
            {t('signUp')}
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
