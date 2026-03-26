'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, AtSign, Check, X } from 'lucide-react';
import { register as registerUser } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { setAccessToken } from '@/lib/api/client';

const registerSchema = z
  .object({
    email: z.string().email('Please enter a valid email'),
    username: z
      .string()
      .min(2, 'Username must be at least 2 characters')
      .max(32, 'Username cannot exceed 32 characters')
      .regex(/^[a-z0-9._-]+$/, 'Only lowercase letters, numbers, dots, underscores and hyphens'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
    terms: z
      .boolean()
      .refine((v) => v === true, 'You must accept the terms of service'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  const colors = [
    '',
    'var(--color-danger-default)',
    'var(--color-danger-hover)',
    'var(--color-warning-default)',
    'var(--color-success-default)',
    'var(--color-success-hover)',
  ];
  return { score, label: labels[score] ?? '', color: colors[score] ?? '' };
}

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

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const setTokens = useAuthStore((s) => s.setTokens);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const usernameValue = watch('username', '');
  const passwordStrength = getPasswordStrength(passwordValue);

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      const res = await registerUser({
        email: data.email,
        username: data.username,
        password: data.password,
      });
      setUser(res.user);
      setTokens(res.tokens.accessToken);
      setAccessToken(res.tokens.accessToken);
      router.push('/channels/@me');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setServerError(message);
    }
  };

  const inputStyle = (hasError: boolean) => ({
    background: 'var(--color-surface-raised)',
    border: hasError
      ? '1px solid var(--color-danger-default)'
      : '1px solid var(--color-border-default)',
    color: 'var(--color-text-primary)',
  });

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>, hasError: boolean) => {
    e.currentTarget.style.borderColor = hasError
      ? 'var(--color-danger-default)'
      : 'var(--color-border-focus)';
    e.currentTarget.style.boxShadow = hasError
      ? '0 0 0 3px rgba(239,68,68,0.15)'
      : '0 0 0 3px rgba(99,102,241,0.15)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>, hasError: boolean) => {
    e.currentTarget.style.borderColor = hasError
      ? 'var(--color-danger-default)'
      : 'var(--color-border-default)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-surface-base py-8">
      {/* Background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)' }}
        />
        <svg className="absolute inset-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[420px] mx-4"
      >
        {/* Logo */}
        <motion.div variants={itemVariants} className="text-center mb-7">
          <div className="inline-flex items-center gap-2.5 mb-5">
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
            <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
              ConstChat
            </span>
          </div>
          <h1
            className="text-3xl font-bold"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
          >
            Create your account
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Join thousands of teams already using ConstChat
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
          {serverError && (
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
                {...register('email')}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-fast"
                style={inputStyle(!!errors.email)}
                onFocus={(e) => handleFocus(e, !!errors.email)}
                onBlur={(e) => handleBlur(e, !!errors.email)}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-danger-default)' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Username
              </label>
              <div className="relative">
                <div
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  <AtSign size={14} />
                </div>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  {...register('username')}
                  className="w-full pl-8 pr-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-fast"
                  style={inputStyle(!!errors.username)}
                  onFocus={(e) => handleFocus(e, !!errors.username)}
                  onBlur={(e) => handleBlur(e, !!errors.username)}
                  placeholder="yourhandle"
                />
              </div>
              {usernameValue && !errors.username && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  Your handle will be{' '}
                  <span style={{ color: 'var(--color-text-accent)' }}>@{usernameValue}</span>
                </p>
              )}
              {errors.username && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-danger-default)' }}>
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...register('password', {
                    onChange: (e) => setPasswordValue(e.target.value),
                  })}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm outline-none transition-all duration-fast"
                  style={inputStyle(!!errors.password)}
                  onFocus={(e) => handleFocus(e, !!errors.password)}
                  onBlur={(e) => handleBlur(e, !!errors.password)}
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* Password strength */}
              {passwordValue && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-normal"
                        style={{
                          background:
                            i <= passwordStrength.score
                              ? passwordStrength.color
                              : 'var(--color-surface-overlay)',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}

              {errors.password && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-danger-default)' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password */}
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
                  style={inputStyle(!!errors.confirmPassword)}
                  onFocus={(e) => handleFocus(e, !!errors.confirmPassword)}
                  onBlur={(e) => handleBlur(e, !!errors.confirmPassword)}
                  placeholder="Repeat your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded"
                  style={{ color: 'var(--color-text-tertiary)' }}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs" style={{ color: 'var(--color-danger-default)' }}>
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Terms */}
            <div>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    {...register('terms')}
                    className="sr-only"
                    id="terms"
                  />
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center transition-all duration-fast"
                    style={{
                      background: 'var(--color-surface-raised)',
                      border: errors.terms
                        ? '1px solid var(--color-danger-default)'
                        : '1px solid var(--color-border-strong)',
                    }}
                  >
                  </div>
                </div>
                <span className="text-sm leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                  I agree to the{' '}
                  <Link
                    href="/terms"
                    className="transition-colors duration-fast"
                    style={{ color: 'var(--color-text-accent)' }}
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/privacy"
                    className="transition-colors duration-fast"
                    style={{ color: 'var(--color-text-accent)' }}
                  >
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {errors.terms && (
                <p className="mt-1 text-xs ml-6.5" style={{ color: 'var(--color-danger-default)' }}>
                  {errors.terms.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-fast mt-2"
              style={{
                background: isSubmitting ? 'var(--color-accent-hover)' : 'var(--color-accent-primary)',
                opacity: isSubmitting ? 0.8 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.background = 'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) e.currentTarget.style.background = 'var(--color-accent-primary)';
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="text-center mt-5 text-sm"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium transition-colors duration-fast"
            style={{ color: 'var(--color-text-accent)' }}
          >
            Sign in
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
