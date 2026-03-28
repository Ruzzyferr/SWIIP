'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { ArrowRight, Download, Globe, MessageCircle, Shield, Users, Mic, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

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

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: 'var(--color-surface-base)' }}>
      {/* ---- Atmospheric Background ---- */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute top-[-20%] left-[30%] w-[700px] h-[700px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #6c5ce7, transparent 65%)' }} />
        <div className="absolute top-[30%] right-[10%] w-[500px] h-[500px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #a29bfe, transparent 65%)' }} />
        <div className="absolute bottom-[-10%] left-[10%] w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #fd79a8, transparent 65%)' }} />
      </div>

      {/* ---- Navigation ---- */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-white text-lg"
              style={{ background: 'var(--color-accent-gradient)' }}>
              S
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
              Swiip
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login"
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.background = 'transparent'; }}>
              {tAuth('submit')}
            </Link>
            <Link href="/register" className="btn-premium">
              {t('cta.button')}
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <section className="relative pt-36 pb-28 px-6 overflow-hidden" style={{ zIndex: 1 }}>
        <div className="relative max-w-4xl mx-auto text-center">
          {/* Beta tag */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-10 animate-fade-in-up"
            style={{
              background: 'rgba(108,92,231,0.08)',
              color: 'var(--color-text-accent)',
              border: '1px solid rgba(108,92,231,0.15)',
              animationDelay: '0.1s',
            }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-status-online)' }} />
            Beta
          </div>

          <h1
            className="font-extrabold leading-none mb-7 animate-fade-in-up"
            style={{
              fontSize: 'clamp(40px, 7vw, 72px)',
              letterSpacing: '-0.04em',
              color: 'var(--color-text-primary)',
              animationDelay: '0.2s',
            }}
          >
            {t('hero.title')}
          </h1>

          <p
            className="text-lg md:text-xl max-w-xl mx-auto mb-12 leading-relaxed animate-fade-in-up"
            style={{ color: 'var(--color-text-secondary)', animationDelay: '0.3s' }}
          >
            {t('hero.subtitle')}
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <a
              href="/downloads/Swiip-Setup-latest.exe"
              className="btn-premium"
              style={{ padding: '14px 32px', fontSize: '15px' }}
            >
              <Download size={18} />
              {t('hero.downloadDesktop')}
            </a>
            <Link href="/register" className="btn-secondary" style={{ padding: '14px 32px', fontSize: '15px' }}>
              <Globe size={18} />
              {t('hero.cta')}
            </Link>
          </div>

          <p className="mt-5 text-xs animate-fade-in-up" style={{ color: 'var(--color-text-disabled)', animationDelay: '0.5s' }}>
            Windows 10/11 &middot; macOS &middot; Web
          </p>
        </div>
      </section>

      {/* ---- Features Grid ---- */}
      <section className="relative py-24 px-6" style={{ zIndex: 1 }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
            >
              {t('cta.title')}
            </h2>
            <p className="max-w-md mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
              {t('cta.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: <MessageCircle size={22} />, title: t('features.messaging.title'), desc: t('features.messaging.description') },
              { icon: <Mic size={22} />, title: t('features.voice.title'), desc: t('features.voice.description') },
              { icon: <Users size={22} />, title: t('features.community.title'), desc: t('features.community.description') },
              { icon: <Shield size={22} />, title: t('features.security.title'), desc: t('features.security.description') },
              { icon: <Zap size={22} />, title: t('features.fast.title'), desc: t('features.fast.description') },
              { icon: <Download size={22} />, title: t('features.native.title'), desc: t('features.native.description') },
            ].map((f, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl transition-all duration-300"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.borderColor = 'rgba(108,92,231,0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--color-accent-muted)', color: 'var(--color-text-accent)' }}
                >
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CTA Banner ---- */}
      <section className="relative py-24 px-6" style={{ zIndex: 1 }}>
        <div
          className="max-w-3xl mx-auto text-center p-12 rounded-3xl relative overflow-hidden"
          style={{
            background: 'rgba(108,92,231,0.06)',
            border: '1px solid rgba(108,92,231,0.12)',
          }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center top, rgba(108,92,231,0.12), transparent 70%)' }} />
          <div className="relative">
            <h2
              className="text-3xl font-bold mb-4"
              style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
            >
              {t('hero.title')}
            </h2>
            <p className="mb-8 max-w-sm mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
              {t('hero.subtitle')}
            </p>
            <Link href="/register" className="btn-premium" style={{ padding: '14px 36px', fontSize: '15px' }}>
              {t('cta.button')}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="py-8 px-6" style={{ borderTop: '1px solid var(--color-border-subtle)', zIndex: 1, position: 'relative' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-white text-xs"
              style={{ background: 'var(--color-accent-gradient)' }}
            >
              S
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
              Swiip
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
            &copy; {new Date().getFullYear()} Swiip. {t('footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}
