'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

export default function LandingPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.accessToken);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (token) {
      router.replace('/channels/@me');
    }
  }, [token, router]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: 'var(--color-surface-base)' }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl" style={{ background: 'rgba(14, 15, 17, 0.85)', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-white text-lg"
              style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), #8b5cf6)' }}>
              S
            </div>
            <span className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Swiip</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}>
              Login
            </Link>
            <Link href="/register"
              className="px-5 py-2 text-sm font-semibold rounded-lg text-white transition-all"
              style={{ background: 'var(--color-accent-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent-primary)')}>
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background gradient effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(ellipse, var(--color-accent-primary), transparent 70%)' }} />
          <div className="absolute top-40 left-1/4 w-[400px] h-[400px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }} />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8"
            style={{ background: 'var(--color-accent-muted)', color: 'var(--color-text-accent)', border: '1px solid var(--color-accent-strong)' }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-status-online)' }} />
            v0.1.0 Beta
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}>
            Welcome to{' '}
            <span style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), #8b5cf6, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Swiip
            </span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}>
            Your next-generation communication platform. Create servers, chat in real-time,
            and stay connected with your community.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/downloads/Swiip-Setup-latest.exe"
              className="group flex items-center gap-3 px-8 py-4 rounded-xl text-white font-semibold text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), #7c3aed)', boxShadow: 'var(--shadow-glow)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download for Windows
              <span className="text-xs opacity-70 font-normal">(82 MB)</span>
            </a>

            <Link href="/register"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--color-surface-raised)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Open in Browser
            </Link>
          </div>

          <p className="mt-4 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Windows 10/11 (64-bit) required
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4"
            style={{ color: 'var(--color-text-primary)' }}>
            Everything you need to communicate
          </h2>
          <p className="text-center mb-16 max-w-xl mx-auto"
            style={{ color: 'var(--color-text-secondary)' }}>
            Built from the ground up for speed, security, and simplicity.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                ),
                title: 'Real-time Messaging',
                desc: 'Send messages instantly with WebSocket-powered delivery. Edit, delete, and react to messages.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ),
                title: 'Server & Channels',
                desc: 'Create servers, organize with text channels, invite members, and manage your community.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                ),
                title: 'Desktop App',
                desc: 'Native Windows application with system tray, notifications, and seamless integration.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                ),
                title: 'Secure by Design',
                desc: 'Email verification, encrypted connections, role-based permissions, and moderation tools.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ),
                title: 'Presence & Status',
                desc: 'See who is online, idle, or offline. Real-time presence tracking across your servers.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                ),
                title: 'Invite System',
                desc: 'Generate invite links with custom expiration and usage limits. Share and grow your server.',
              },
            ].map((feature, i) => (
              <div key={i}
                className="p-6 rounded-2xl transition-all hover:-translate-y-1"
                style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-subtle)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--color-accent-muted)', color: 'var(--color-text-accent)' }}>
                  {feature.icon}
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center p-10 rounded-3xl relative overflow-hidden"
          style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="absolute inset-0 pointer-events-none opacity-30"
            style={{ background: 'radial-gradient(ellipse at center, var(--color-accent-primary), transparent 70%)' }} />
          <div className="relative">
            <h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Ready to get started?
            </h2>
            <p className="mb-8" style={{ color: 'var(--color-text-secondary)' }}>
              Download Swiip for Windows or use it directly in your browser.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="/downloads/Swiip-Setup-latest.exe"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, var(--color-accent-primary), #7c3aed)', boxShadow: 'var(--shadow-glow)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download for Windows
              </a>
              <Link href="/register"
                className="px-6 py-3 rounded-xl font-semibold transition-all hover:scale-[1.02]"
                style={{ color: 'var(--color-text-accent)' }}>
                Create an Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-white text-xs"
              style={{ background: 'var(--color-accent-primary)' }}>
              S
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Swiip v0.1.0
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            &copy; 2025 Swiip. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
