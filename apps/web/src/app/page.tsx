'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { ArrowRight, Download, Globe, MessageCircle, Mic, Users, Shield, Zap, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ParticleBackground } from '@/components/ui/ParticleBackground';
import { TextReveal, WordStagger } from '@/components/ui/TextReveal';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { NoiseTexture } from '@/components/ui/NoiseTexture';
import { FeatureShowcase } from '@/components/landing/FeatureShowcase';

const spring = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 };

function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.section
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...spring, duration: 0.7 }}
    >
      {children}
    </motion.section>
  );
}

export default function LandingPage() {
  const t = useTranslations('landing');
  const tAuth = useTranslations('auth.login');
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (token) {
      router.replace('/channels/@me');
      return;
    }
    if (typeof window !== 'undefined' && window.constchat?.platform === 'desktop') {
      router.replace('/login');
    }
  }, [token, router]);

  if (!mounted) return null;

  const features = [
    { title: t('features.messaging.title'), description: t('features.messaging.description'), icon: MessageCircle },
    { title: t('features.voice.title'), description: t('features.voice.description'), icon: Mic },
    { title: t('features.community.title'), description: t('features.community.description'), icon: Users },
    { title: t('features.security.title'), description: t('features.security.description'), icon: Shield },
    { title: t('features.fast.title'), description: t('features.fast.description'), icon: Zap },
    { title: t('features.native.title'), description: t('features.native.description'), icon: Monitor },
  ];

  return (
    <div className="min-h-[100dvh] overflow-x-hidden" style={{ background: 'var(--color-surface-base)' }}>
      <ParticleBackground />

      {/* ---- Navigation ---- */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          background: 'rgba(10, 14, 16, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ ...spring, delay: 0.1 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          <motion.div
            className="flex items-center gap-2 sm:gap-3 min-w-0"
            whileHover={{ scale: 1.02 }}
            transition={spring}
          >
            <Image src="/logo.png" alt="Swiip" width={40} height={40} className="rounded-xl w-9 h-9 sm:w-10 sm:h-10" />
            <span className="text-base sm:text-lg font-bold tracking-tight truncate" style={{ color: 'var(--color-text-primary)' }}>
              Swiip
            </span>
          </motion.div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <MagneticButton
              as="a"
              href="/login"
              className="px-2.5 py-2 sm:px-4 text-xs sm:text-sm font-medium rounded-lg"
              style={{ color: 'var(--color-text-secondary)', background: 'transparent' }}
              strength={0.2}
            >
              {tAuth('submit')}
            </MagneticButton>
            <MagneticButton
              as="a"
              href="/register"
              className="btn-premium gradient-border text-xs sm:text-sm !px-3 sm:!px-4 !py-2 inline-flex items-center gap-1.5"
              strength={0.25}
            >
              <span className="max-[360px]:hidden">{t('cta.button')}</span>
              <span className="hidden max-[360px]:inline">{t('cta.button').split(' ')[0]}</span>
              <ArrowRight size={14} className="shrink-0" />
            </MagneticButton>
          </div>
        </div>
      </motion.nav>

      {/* ---- Hero ---- */}
      <motion.section
        className="relative z-[1] pt-[4.5rem] sm:pt-24 pb-8 sm:pb-14 px-4 sm:px-6 lg:px-8 overflow-hidden"
      >
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-90"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 80% 55% at 50% -10%, rgba(16,185,129,0.14), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 20%, rgba(16,185,129,0.06), transparent 50%), radial-gradient(ellipse 50% 35% at 0% 60%, rgba(52,211,153,0.05), transparent 45%)',
          }}
        />
        <div className="relative max-w-5xl mx-auto">
          {/* Two-column hero — top-aligned */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-start">
            {/* Left: Text */}
            <div>
              {/* Beta badge */}
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8"
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  color: 'var(--color-text-accent)',
                  border: '1px solid rgba(16,185,129,0.15)',
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring, delay: 0.2 }}
              >
                <span className="w-1.5 h-1.5 rounded-full glow-pulse" style={{ background: 'var(--color-status-online)' }} />
                Beta
              </motion.div>

              {/* Headline */}
              <div
                className="font-extrabold leading-[1.05] mb-4 sm:mb-6"
                style={{
                  fontSize: 'clamp(1.75rem, 5vw + 0.5rem, 3.5rem)',
                  letterSpacing: '-0.04em',
                  color: 'var(--color-text-primary)',
                }}
              >
                <TextReveal text={t('hero.title')} delay={300} duration={1200} />
              </div>

              {/* Subtitle */}
              <div
                className="text-base lg:text-lg max-w-md mb-6 sm:mb-10 leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <WordStagger text={t('hero.subtitle')} delay={0.35} />
              </div>

              {/* CTA Buttons */}
              <motion.div
                className="flex flex-col sm:flex-row items-start gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 1.2 }}
              >
                <MagneticButton
                  as="a"
                  href="/downloads/Swiip-Setup-latest.exe"
                  className="btn-premium gradient-border"
                  style={{ padding: '13px 28px', fontSize: '14px' }}
                  strength={0.3}
                >
                  <Download size={16} />
                  {t('hero.downloadDesktop')}
                </MagneticButton>
                <MagneticButton
                  as="a"
                  href="/register"
                  className="btn-secondary"
                  style={{ padding: '13px 28px', fontSize: '14px' }}
                  strength={0.3}
                >
                  <Globe size={16} />
                  {t('hero.cta')}
                </MagneticButton>
              </motion.div>

              <motion.p
                className="mt-4 text-xs"
                style={{ color: 'var(--color-text-disabled)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
              >
                Windows 10/11 &middot; macOS &middot; Web
              </motion.p>
            </div>

            {/* Right: App Preview Mockup */}
            <motion.div
              className="relative w-full max-w-xl mx-auto lg:max-w-none lg:mx-0"
              initial={{ opacity: 0, x: 40, rotateY: -8 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ ...spring, delay: 0.6, duration: 1 }}
              style={{ perspective: '1200px' }}
            >
              <div
                className="rounded-2xl overflow-hidden relative"
                style={{
                  background: 'rgba(14, 18, 22, 0.9)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)',
                }}
              >
                {/* Title bar */}
                <div
                  className="flex items-center gap-2 px-4 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(10,14,16,0.8)' }}
                >
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e' }} />
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-2 px-4 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <Image src="/logo.png" alt="" width={14} height={14} className="rounded" />
                      <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-disabled)' }}>Swiip</span>
                    </div>
                  </div>
                  <div className="w-12" />
                </div>

                {/* Mock app content */}
                <div className="flex" style={{ minHeight: 220 }}>
                  {/* Sidebar */}
                  <div className="w-14 flex-shrink-0 flex flex-col items-center gap-2 py-3" style={{ background: 'rgba(8,12,14,0.9)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="w-9 h-9 rounded-xl" style={{ background: 'rgba(16,185,129,0.15)' }}>
                      <div className="w-full h-full flex items-center justify-center">
                        <Image src="/logo.png" alt="" width={20} height={20} className="rounded" />
                      </div>
                    </div>
                    <div className="w-6 h-px my-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-9 h-9 rounded-xl"
                        style={{ background: i === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)' }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1.0 + i * 0.1, type: 'spring', stiffness: 400, damping: 20 }}
                      />
                    ))}
                  </div>

                  {/* Channel list */}
                  <div className="w-40 flex-shrink-0 py-3 px-2 space-y-1" style={{ background: 'rgba(12,16,18,0.6)', borderRight: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="px-2 mb-2">
                      <div className="h-2.5 w-20 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
                    </div>
                    {['# general', '# design', '# dev'].map((ch, i) => (
                      <motion.div
                        key={ch}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px]"
                        style={{
                          background: i === 0 ? 'rgba(16,185,129,0.08)' : 'transparent',
                          color: i === 0 ? 'var(--color-accent-primary)' : 'var(--color-text-disabled)',
                        }}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.2 + i * 0.08 }}
                      >
                        {ch}
                      </motion.div>
                    ))}
                  </div>

                  {/* Chat area */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex-1 p-3 space-y-3">
                      {[
                        { w: 140, msg: 100, delay: 1.3 },
                        { w: 100, msg: 160, delay: 1.45 },
                        { w: 120, msg: 130, delay: 1.6 },
                      ].map((m, i) => (
                        <motion.div
                          key={i}
                          className="flex items-start gap-2"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: m.delay, type: 'spring', stiffness: 300, damping: 25 }}
                        >
                          <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: `hsl(${150 + i * 40}, 50%, 40%)` }} />
                          <div className="space-y-1">
                            <div className="h-2 rounded" style={{ width: m.w * 0.5, background: 'rgba(255,255,255,0.15)' }} />
                            <div className="h-2 rounded" style={{ width: m.msg, background: 'rgba(255,255,255,0.06)' }} />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    {/* Input */}
                    <div className="px-3 pb-3">
                      <motion.div
                        className="rounded-lg px-3 py-2 flex items-center"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.7 }}
                      >
                        <div className="h-2 w-24 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ambient glow */}
              <div
                className="absolute -inset-10 rounded-3xl -z-10"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.08), transparent 70%)',
                  filter: 'blur(40px)',
                }}
              />
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ---- Interactive Feature Showcase ---- */}
      <AnimatedSection className="relative pt-6 sm:pt-10 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
        <FeatureShowcase
          features={features}
          sectionTitle={t('cta.title')}
          sectionSubtitle={t('cta.subtitle')}
        />
      </AnimatedSection>

      {/* ---- Stats ---- */}
      <AnimatedSection className="relative py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              { value: '50ms', label: 'Latency' },
              { value: 'TLS', label: 'Encrypted' },
              { value: '\u221E', label: 'Channels' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className="text-center p-6 sm:p-8 rounded-2xl relative overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
                whileHover={{
                  scale: 1.04,
                  borderColor: 'rgba(16,185,129,0.15)',
                }}
                transition={spring}
              >
                <NoiseTexture opacity={0.03} />
                <div
                  className="text-3xl md:text-4xl font-bold mb-2"
                  style={{
                    background: 'var(--color-accent-gradient-vibrant)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {stat.value}
                </div>
                <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ---- CTA Banner ---- */}
      <AnimatedSection className="relative py-14 sm:py-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-4xl mx-auto text-center p-8 sm:p-12 md:p-14 rounded-3xl relative overflow-hidden"
          style={{
            background: 'rgba(16,185,129,0.04)',
            border: '1px solid rgba(16,185,129,0.1)',
          }}
          whileHover={{ scale: 1.005, boxShadow: '0 0 80px rgba(16,185,129,0.08)' }}
          transition={spring}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center top, rgba(16,185,129,0.1), transparent 70%)' }} />
          <NoiseTexture opacity={0.03} />
          <div className="relative z-10">
            <h2
              className="text-3xl font-bold mb-4"
              style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
            >
              {t('hero.title')}
            </h2>
            <p className="mb-8 max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
              {t('hero.subtitle')}
            </p>
            <MagneticButton
              as="a"
              href="/register"
              className="btn-premium gradient-border"
              style={{ padding: '14px 36px', fontSize: '15px' }}
              strength={0.3}
            >
              {t('cta.button')}
              <ArrowRight size={16} />
            </MagneticButton>
          </div>
        </motion.div>
      </AnimatedSection>

      {/* ---- Footer ---- */}
      <footer className="relative py-8 px-4 sm:px-6 lg:px-8" style={{ zIndex: 1 }}>
        <div className="h-px w-full mb-8" style={{
          background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.3), transparent)',
        }} />
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.03 }}
            transition={spring}
          >
            <Image src="/logo.png" alt="Swiip" width={32} height={32} className="rounded-md" />
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
              Swiip
            </span>
          </motion.div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs transition-colors" style={{ color: 'var(--color-text-disabled)' }}>
              Privacy
            </Link>
            <Link href="/terms" className="text-xs transition-colors" style={{ color: 'var(--color-text-disabled)' }}>
              Terms
            </Link>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
            &copy; {new Date().getFullYear()} Swiip. {t('footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}
