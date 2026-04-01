'use client';

import { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Eye, EyeOff, Loader2, Github, Chrome, Check } from 'lucide-react';
import { login } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { setAccessToken } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import { MeshGradient } from '@/components/ui/MeshGradient';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { InteractiveOwl } from '@/components/ui/InteractiveOwl';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

const spring = { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.8 };

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: spring,
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
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success'>('idle');

  // Owl state tracking
  const [owlState, setOwlState] = useState<'idle' | 'watching' | 'hiding' | 'error' | 'success'>('idle');
  const [emailLength, setEmailLength] = useState(0);
  const maxEmailChars = 30; // for owl eye tracking progress

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setSubmitState('loading');
    setOwlState('idle');
    try {
      const res = await login({ email: data.email, password: data.password });
      setUser(res.user);
      setTokens(res.tokens.accessToken, res.sessionId);
      setAccessToken(res.tokens.accessToken);

      setSubmitState('success');
      setOwlState('success');
      await new Promise((r) => setTimeout(r, 800));

      if (!res.user.verified) {
        router.push('/verify-email');
      } else {
        router.push(redirectTo || '/channels/@me');
      }
    } catch (err: unknown) {
      setSubmitState('idle');
      setOwlState('error');
      const message =
        err instanceof Error ? err.message : 'Invalid email or password';
      setServerError(message);
      // Reset owl back to idle after shake
      setTimeout(() => setOwlState('idle'), 800);
    }
  };

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-start py-8 px-3 sm:px-4 sm:justify-center sm:py-10 overflow-x-hidden" style={{ background: 'var(--color-surface-base)' }}>
      {/* Animated mesh gradient background */}
      <MeshGradient intensity="medium" />

      {/* Auth card */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[400px] mx-4"
      >
        {/* Owl mascot + branding */}
        <motion.div variants={itemVariants} className="text-center mb-6">
          <Link href="/" className="inline-block mb-2 transition-opacity hover:opacity-90">
            <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
              Swiip
            </span>
          </Link>

          {/* Interactive owl — reacts to form state */}
          <motion.div
            className="flex justify-center mb-4"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
          >
            <InteractiveOwl
              state={owlState}
              watchProgress={Math.min(emailLength / maxEmailChars, 1)}
              size={160}
            />
          </motion.div>

          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
          >
            {t('title')}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Form card with glass + noise */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl p-6 relative overflow-hidden gradient-border"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
          }}
        >
          <NoiseTexture opacity={0.025} />

          <div className="relative z-10">
            {/* Server error */}
            <AnimatePresence>
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={spring}
                  className="px-3 py-2.5 rounded-lg text-sm overflow-hidden"
                  style={{
                    background: 'var(--color-danger-muted)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#fca5a5',
                  }}
                >
                  {serverError}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {/* Email */}
              <motion.div variants={itemVariants}>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {t('email')}
                </label>
                <div className="relative group">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    {...register('email', {
                      onChange: (e) => setEmailLength(e.target.value.length),
                    })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={{
                      background: 'var(--color-surface-raised)',
                      border: errors.email
                        ? '1px solid var(--color-danger-default)'
                        : '1px solid var(--color-border-default)',
                      color: 'var(--color-text-primary)',
                      transitionDuration: 'var(--duration-fast)',
                    }}
                    onFocus={(e) => {
                      setOwlState('watching');
                      e.currentTarget.style.borderColor = errors.email
                        ? 'var(--color-danger-default)'
                        : 'var(--color-border-focus)';
                      e.currentTarget.style.boxShadow = errors.email
                        ? '0 0 0 3px rgba(239,68,68,0.15), 0 0 20px rgba(239,68,68,0.05)'
                        : '0 0 0 3px rgba(16,185,129,0.15), 0 0 20px rgba(16,185,129,0.05)';
                    }}
                    onBlur={(e) => {
                      setOwlState('idle');
                      e.currentTarget.style.borderColor = errors.email
                        ? 'var(--color-danger-default)'
                        : 'var(--color-border-default)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    placeholder="you@example.com"
                  />
                </div>
                <AnimatePresence>
                  {errors.email && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-danger-default)' }}
                    >
                      {errors.email.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Password */}
              <motion.div variants={itemVariants}>
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
                    className="text-xs transition-colors"
                    style={{ color: 'var(--color-text-accent)', transitionDuration: 'var(--duration-fast)' }}
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
                    className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none transition-all"
                    style={{
                      background: 'var(--color-surface-raised)',
                      border: errors.password
                        ? '1px solid var(--color-danger-default)'
                        : '1px solid var(--color-border-default)',
                      color: 'var(--color-text-primary)',
                      transitionDuration: 'var(--duration-fast)',
                    }}
                    onFocus={(e) => {
                      setOwlState('hiding');
                      e.currentTarget.style.borderColor = errors.password
                        ? 'var(--color-danger-default)'
                        : 'var(--color-border-focus)';
                      e.currentTarget.style.boxShadow = errors.password
                        ? '0 0 0 3px rgba(239,68,68,0.15), 0 0 20px rgba(239,68,68,0.05)'
                        : '0 0 0 3px rgba(16,185,129,0.15), 0 0 20px rgba(16,185,129,0.05)';
                    }}
                    onBlur={(e) => {
                      setOwlState('idle');
                      e.currentTarget.style.borderColor = errors.password
                        ? 'var(--color-danger-default)'
                        : 'var(--color-border-default)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    placeholder="••••••••"
                  />
                  <motion.button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                    style={{ color: 'var(--color-text-tertiary)', transitionDuration: 'var(--duration-fast)' }}
                    tabIndex={-1}
                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </motion.button>
                </div>
                <AnimatePresence>
                  {errors.password && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-danger-default)' }}
                    >
                      {errors.password.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Submit — morphing button */}
              <motion.div variants={itemVariants}>
                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 mt-2 relative overflow-hidden"
                  style={{
                    background: submitState === 'success'
                      ? 'var(--color-success-default)'
                      : 'var(--color-accent-gradient)',
                    opacity: isSubmitting ? 0.9 : 1,
                  }}
                  whileHover={submitState === 'idle' ? { scale: 1.02, boxShadow: '0 6px 25px rgba(16,185,129,0.4)' } : {}}
                  whileTap={submitState === 'idle' ? { scale: 0.98 } : {}}
                  transition={spring}
                  layout
                >
                  <AnimatePresence mode="wait">
                    {submitState === 'loading' && (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="flex items-center gap-2"
                      >
                        <Loader2 size={15} className="animate-spin" />
                        {t('submitting')}
                      </motion.span>
                    )}
                    {submitState === 'success' && (
                      <motion.span
                        key="success"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      >
                        <Check size={20} strokeWidth={3} />
                      </motion.span>
                    )}
                    {submitState === 'idle' && (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {t('submit')}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>
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
              {[
                { icon: <Github size={15} />, label: 'GitHub' },
                { icon: <Chrome size={15} />, label: 'Google' },
              ].map((social) => (
                <motion.button
                  key={social.label}
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
                  style={{
                    background: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border-default)',
                    color: 'var(--color-text-secondary)',
                  }}
                  title="Coming soon"
                  whileHover={{ scale: 1.02 }}
                  transition={spring}
                >
                  {social.icon}
                  {social.label}
                  <span className="text-xs">({tCommon('comingSoon')})</span>
                </motion.button>
              ))}
            </div>
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
            className="font-medium transition-colors"
            style={{ color: 'var(--color-text-accent)', transitionDuration: 'var(--duration-fast)' }}
          >
            {t('signUp')}
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
