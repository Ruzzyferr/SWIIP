'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.08 },
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

const sections = [
  {
    title: '1. Acceptance of Terms',
    content:
      'By accessing or using Swiip ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.',
  },
  {
    title: '2. Description of Service',
    content:
      'Swiip is a real-time communication platform that provides text messaging, voice and video calls, file sharing, and related collaboration features. We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time.',
  },
  {
    title: '3. User Accounts',
    content:
      'You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 13 years old to use the Service.',
  },
  {
    title: '4. Acceptable Use',
    content:
      'You agree not to use the Service to: distribute spam or unsolicited messages; upload malicious software; harass, bully, or threaten other users; impersonate any person or entity; violate any applicable laws or regulations; or attempt to gain unauthorized access to the Service or other users\' accounts.',
  },
  {
    title: '5. User Content',
    content:
      'You retain ownership of content you create and share through the Service. By posting content, you grant Swiip a non-exclusive, worldwide license to use, store, and display your content solely for the purpose of operating and improving the Service. You are solely responsible for the content you share.',
  },
  {
    title: '6. Privacy',
    content:
      'Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please review our Privacy Policy to understand how we collect, use, and protect your information.',
  },
  {
    title: '7. Intellectual Property',
    content:
      'The Service, including its design, features, and underlying technology, is owned by Swiip and protected by intellectual property laws. You may not copy, modify, distribute, or reverse-engineer any part of the Service without our prior written consent.',
  },
  {
    title: '8. Termination',
    content:
      'We may suspend or terminate your access to the Service at any time, with or without cause and without prior notice. Upon termination, your right to use the Service immediately ceases. You may delete your account at any time through your account settings.',
  },
  {
    title: '9. Disclaimers',
    content:
      'The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied. We do not guarantee that the Service will be uninterrupted, secure, or error-free.',
  },
  {
    title: '10. Limitation of Liability',
    content:
      'To the maximum extent permitted by law, Swiip shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service.',
  },
  {
    title: '11. Changes to Terms',
    content:
      'We may update these Terms from time to time. We will notify you of significant changes through the Service or via email. Your continued use of the Service after such changes constitutes acceptance of the updated Terms.',
  },
  {
    title: '12. Contact',
    content:
      'If you have questions about these Terms, please contact us at support@swiip.app.',
  },
];

export default function TermsPage() {
  return (
    <div className="relative min-h-screen bg-surface-base">
      {/* Background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
          }}
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-2xl mx-auto px-5 py-12"
      >
        {/* Back link */}
        <motion.div variants={itemVariants} className="mb-8">
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 text-sm transition-colors duration-fast"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <ArrowLeft size={14} />
            Back to sign up
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="inline-flex items-center gap-2.5 mb-5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--color-accent-primary)' }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 6C4 4.895 4.895 4 6 4H14C15.105 4 16 4.895 16 6V11C16 12.105 15.105 13 14 13H11L8 16V13H6C4.895 13 4 12.105 4 11V6Z"
                  fill="white"
                />
              </svg>
            </div>
            <span
              className="text-lg font-bold tracking-tight"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Swiip
            </span>
          </div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
          >
            Terms of Service
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Last updated: March 27, 2026
          </p>
        </motion.div>

        {/* Content */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl p-6 space-y-6"
          style={{
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          {sections.map((section) => (
            <div key={section.title}>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {section.title}
              </h2>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {section.content}
              </p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
