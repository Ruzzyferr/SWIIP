'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Mic, Users, Shield, Zap, Download } from 'lucide-react';

interface Feature {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  mockup: React.ReactNode;
}

interface FeatureShowcaseProps {
  features: { title: string; description: string }[];
  sectionTitle: string;
  sectionSubtitle: string;
}

const iconMap = [
  <MessageCircle size={22} key="msg" />,
  <Mic size={22} key="mic" />,
  <Users size={22} key="users" />,
  <Shield size={22} key="shield" />,
  <Zap size={22} key="zap" />,
  <Download size={22} key="dl" />,
];

function MockupScreen({ activeIndex }: { activeIndex: number }) {
  const screens = [
    // Messaging mockup
    <div key="msg" className="space-y-3 p-4">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.1 }}
          className="flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-full shrink-0" style={{ background: 'var(--color-accent-muted)' }} />
          <div className="space-y-1.5">
            <div className="h-3 rounded" style={{ width: [120, 90, 150][i], background: 'var(--color-text-tertiary)', opacity: 0.3 }} />
            <div className="h-2.5 rounded" style={{ width: [200, 160, 180][i], background: 'rgba(255,255,255,0.08)' }} />
          </div>
        </motion.div>
      ))}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 25 }}
        className="flex items-center gap-2 mt-4 p-2.5 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="h-2.5 rounded flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="w-6 h-6 rounded-md" style={{ background: 'var(--color-accent-gradient)' }} />
      </motion.div>
    </div>,

    // Voice mockup
    <div key="voice" className="flex flex-col items-center justify-center p-6 gap-4">
      <div className="flex items-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: i * 0.08 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full" style={{ background: 'var(--color-surface-overlay)' }} />
              {i < 2 && (
                <motion.div
                  className="absolute inset-[-3px] rounded-full"
                  style={{ border: '2px solid var(--color-accent-primary)' }}
                  animate={{ scale: [1, 1.15, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                />
              )}
            </div>
            <div className="h-2 w-10 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </motion.div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        {['var(--color-accent-primary)', 'var(--color-danger-default)', 'var(--color-text-tertiary)'].map((bg, i) => (
          <motion.div
            key={i}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: `${bg}20` }}
          >
            <div className="w-4 h-4 rounded-sm" style={{ background: bg }} />
          </motion.div>
        ))}
      </div>
    </div>,

    // Community mockup
    <div key="community" className="p-4 space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, delay: i * 0.06 }}
          className="flex items-center gap-2.5 p-2 rounded-lg"
          style={{ background: i === 1 ? 'var(--color-accent-muted)' : 'transparent' }}
        >
          <div className="w-5 h-5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="h-2.5 rounded flex-1" style={{ width: [100, 80, 120, 95, 110][i], background: i === 1 ? 'var(--color-text-primary)' : 'rgba(255,255,255,0.15)', opacity: i === 1 ? 0.6 : 0.3 }} />
        </motion.div>
      ))}
    </div>,

    // Security mockup
    <div key="security" className="flex flex-col items-center justify-center p-6 gap-4">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--color-accent-muted)' }}
      >
        <Shield size={32} style={{ color: 'var(--color-accent-primary)' }} />
      </motion.div>
      <div className="space-y-2 w-full max-w-[160px]">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.3 + i * 0.1, type: 'spring', stiffness: 300, damping: 25 }}
            className="h-2 rounded-full origin-left"
            style={{ background: 'var(--color-accent-gradient)', opacity: 1 - i * 0.3 }}
          />
        ))}
      </div>
    </div>,

    // Speed mockup
    <div key="speed" className="flex flex-col items-center justify-center p-6 gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="w-14 h-14 rounded-full"
        style={{ border: '3px solid transparent', borderTopColor: 'var(--color-accent-primary)', borderRightColor: 'var(--color-accent-primary)' }}
      />
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: '80%' }}
        transition={{ delay: 0.2, duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
        className="h-2 rounded-full"
        style={{ background: 'var(--color-accent-gradient)' }}
      />
      <div className="text-xs font-mono" style={{ color: 'var(--color-accent-primary)' }}>{'< 50ms'}</div>
    </div>,

    // Native mockup
    <div key="native" className="p-4 space-y-3">
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex items-center gap-2 p-2 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#EF4444' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#F59E0B' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#22C55E' }} />
        </div>
        <div className="h-2 flex-1 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </motion.div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 + i * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
            className="aspect-square rounded-lg"
            style={{ background: i === 0 ? 'var(--color-accent-muted)' : 'rgba(255,255,255,0.04)' }}
          />
        ))}
      </div>
    </div>,
  ];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeIndex}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {screens[activeIndex]}
      </motion.div>
    </AnimatePresence>
  );
}

export function FeatureShowcase({ features, sectionTitle, sectionSubtitle }: FeatureShowcaseProps) {
  const [active, setActive] = useState(0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <h2
          className="text-3xl md:text-4xl font-bold mb-4"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
        >
          {sectionTitle}
        </h2>
        <p className="max-w-md mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
          {sectionSubtitle}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Feature list */}
        <div className="space-y-2">
          {features.map((f, i) => (
            <motion.button
              key={i}
              onClick={() => setActive(i)}
              className="w-full text-left p-4 rounded-xl transition-all duration-200 flex items-start gap-4"
              style={{
                background: active === i ? 'var(--ambient-primary-subtle, rgba(16,185,129,0.08))' : 'transparent',
                border: `1px solid ${active === i ? 'rgba(var(--ambient-rgb, 16, 185, 129), 0.15)' : 'transparent'}`,
              }}
              whileHover={{ x: 4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background: active === i ? 'var(--ambient-primary-muted, rgba(16,185,129,0.15))' : 'rgba(255,255,255,0.04)',
                  color: active === i ? 'var(--ambient-primary, #10B981)' : 'var(--color-text-tertiary)',
                  transition: 'all 0.3s',
                }}
              >
                {iconMap[i]}
              </div>
              <div>
                <h3
                  className="text-sm font-semibold mb-1"
                  style={{ color: active === i ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                >
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                  {f.description}
                </p>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Interactive mockup */}
        <div className="relative">
          <motion.div
            className="relative rounded-2xl overflow-hidden noise-texture"
            style={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
              minHeight: 280,
              perspective: '1000px',
            }}
            whileHover={{
              rotateY: 2,
              rotateX: -1,
              scale: 1.02,
            }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          >
            {/* Window chrome */}
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
              </div>
              <div className="h-5 flex-1 rounded-md mx-8" style={{ background: 'rgba(255,255,255,0.03)' }} />
            </div>

            {/* Mockup content */}
            <MockupScreen activeIndex={active} />
          </motion.div>

          {/* Ambient glow behind mockup */}
          <div
            className="absolute -inset-8 rounded-3xl -z-10"
            style={{
              background: 'radial-gradient(ellipse at center, var(--ambient-primary-subtle, rgba(16,185,129,0.08)), transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
