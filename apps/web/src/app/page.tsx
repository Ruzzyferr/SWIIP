'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { ArrowRight, Download, Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ParticleBackground } from '@/components/ui/ParticleBackground';
import { TextReveal, WordStagger } from '@/components/ui/TextReveal';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { FeatureShowcase } from '@/components/landing/FeatureShowcase';
import { NoiseTexture } from '@/components/ui/NoiseTexture';

// Spring config for landing page animations
const spring = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 };

function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.section
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 50, filter: 'blur(6px)' }}
      animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
      transition={{ ...spring, duration: 0.8 }}
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
  const heroRef = useRef(null);

  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -40]);

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
    { title: t('features.messaging.title'), description: t('features.messaging.description') },
    { title: t('features.voice.title'), description: t('features.voice.description') },
    { title: t('features.community.title'), description: t('features.community.description') },
    { title: t('features.security.title'), description: t('features.security.description') },
    { title: t('features.fast.title'), description: t('features.fast.description') },
    { title: t('features.native.title'), description: t('features.native.description') },
  ];

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: 'var(--color-surface-base)' }}>
      {/* ---- Particle Constellation Background ---- */}
      <ParticleBackground />

      {/* ---- Navigation ---- */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 glass-heavy"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ ...spring, delay: 0.1 }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
            transition={spring}
          >
            <Image src="/logo.png" alt="Swiip" width={72} height={72} className="rounded-xl" />
            <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
              Swiip
            </span>
          </motion.div>
          <div className="flex items-center gap-3">
            <MagneticButton
              as="a"
              href="/login"
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ color: 'var(--color-text-secondary)', background: 'transparent' }}
              strength={0.2}
            >
              {tAuth('submit')}
            </MagneticButton>
            <MagneticButton
              as="a"
              href="/register"
              className="btn-premium gradient-border"
              strength={0.25}
            >
              {t('cta.button')}
              <ArrowRight size={14} />
            </MagneticButton>
          </div>
        </div>
      </motion.nav>

      {/* ---- Hero ---- */}
      <motion.section
        ref={heroRef}
        className="relative pt-36 pb-28 px-6 overflow-hidden"
        style={{ zIndex: 1, opacity: heroOpacity, scale: heroScale, y: heroY }}
      >
        <div className="relative max-w-4xl mx-auto text-center">
          {/* Beta badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-10"
            style={{
              background: 'rgba(16,185,129,0.08)',
              color: 'var(--color-text-accent)',
              border: '1px solid rgba(16,185,129,0.15)',
            }}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...spring, delay: 0.2 }}
          >
            <span className="w-1.5 h-1.5 rounded-full glow-pulse" style={{ background: 'var(--color-status-online)' }} />
            Beta
          </motion.div>

          {/* Headline with text decode effect */}
          <div
            className="font-extrabold leading-none mb-7"
            style={{
              fontSize: 'clamp(40px, 7vw, 72px)',
              letterSpacing: '-0.04em',
              color: 'var(--color-text-primary)',
            }}
          >
            <TextReveal text={t('hero.title')} delay={400} duration={1800} />
          </div>

          {/* Subtitle with word stagger */}
          <div className="text-lg md:text-xl max-w-xl mx-auto mb-12 leading-relaxed">
            <WordStagger
              text={t('hero.subtitle')}
              delay={1.0}
              className="block"
            />
          </div>

          {/* CTA Buttons — Magnetic */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 1.5 }}
          >
            <MagneticButton
              as="a"
              href="/downloads/Swiip-Setup-latest.exe"
              className="btn-premium gradient-border"
              style={{ padding: '14px 32px', fontSize: '15px' }}
              strength={0.3}
            >
              <Download size={18} />
              {t('hero.downloadDesktop')}
            </MagneticButton>
            <MagneticButton
              as="a"
              href="/register"
              className="btn-secondary"
              style={{ padding: '14px 32px', fontSize: '15px' }}
              strength={0.3}
            >
              <Globe size={18} />
              {t('hero.cta')}
            </MagneticButton>
          </motion.div>

          <motion.p
            className="mt-5 text-xs"
            style={{ color: 'var(--color-text-disabled)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.0 }}
          >
            Windows 10/11 &middot; macOS &middot; Web
          </motion.p>
        </div>
      </motion.section>

      {/* ---- Feature Showcase (Interactive) ---- */}
      <AnimatedSection className="relative py-24 px-6" >
        <div style={{ zIndex: 1, position: 'relative' }}>
          <FeatureShowcase
            features={features}
            sectionTitle={t('cta.title')}
            sectionSubtitle={t('cta.subtitle')}
          />
        </div>
      </AnimatedSection>

      {/* ---- Stats / Social Proof ---- */}
      <AnimatedSection className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-8">
            {[
              { value: '50ms', label: 'Latency' },
              { value: 'E2E', label: 'Encryption' },
              { value: '∞', label: 'Channels' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className="text-center p-6 rounded-2xl noise-texture relative overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
                whileHover={{
                  scale: 1.05,
                  borderColor: 'rgba(var(--ambient-rgb, 16, 185, 129), 0.2)',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
                }}
                transition={spring}
              >
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
      <AnimatedSection className="relative py-24 px-6">
        <motion.div
          className="max-w-3xl mx-auto text-center p-12 rounded-3xl relative overflow-hidden noise-texture"
          style={{
            background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.12)',
          }}
          whileHover={{ scale: 1.01, boxShadow: '0 0 60px rgba(16,185,129,0.1)' }}
          transition={spring}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center top, rgba(16,185,129,0.12), transparent 70%)' }} />
          <NoiseTexture opacity={0.04} />
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
      <footer className="relative py-8 px-6" style={{ zIndex: 1 }}>
        {/* Animated gradient line */}
        <div className="h-px w-full mb-8" style={{
          background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.3), transparent)',
        }} />
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <motion.div
            className="flex items-center gap-2"
            whileHover={{ scale: 1.03 }}
            transition={spring}
          >
            <Image src="/logo.png" alt="Swiip" width={48} height={48} className="rounded-md" />
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
              Swiip
            </span>
          </motion.div>
          <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
            &copy; {new Date().getFullYear()} Swiip. {t('footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}
