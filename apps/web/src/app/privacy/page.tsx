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
    title: '1. Information We Collect',
    content:
      'We collect information you provide directly, such as your email address, username, and profile details when you create an account. We also collect messages, files, and other content you share through the Service. Additionally, we automatically collect usage data including IP addresses, device information, browser type, and interaction data.',
  },
  {
    title: '2. How We Use Your Information',
    content:
      'We use your information to: operate and maintain the Service; deliver messages and content to your intended recipients; authenticate your identity and secure your account; send you important service-related notifications; improve and optimize the Service; comply with legal obligations; and prevent fraud, abuse, and violations of our Terms of Service.',
  },
  {
    title: '3. Message Privacy',
    content:
      'Your messages are transmitted securely and stored in encrypted form. We do not sell your message content to third parties. We do not read your private messages unless required by law or necessary to enforce our Terms of Service (e.g., investigating reports of abuse).',
  },
  {
    title: '4. Data Sharing',
    content:
      'We do not sell your personal information. We may share your information with: service providers who assist in operating the Service (hosting, analytics, email delivery); law enforcement when required by valid legal process; other users, but only information you choose to make public (e.g., username, avatar, status).',
  },
  {
    title: '5. Data Retention',
    content:
      'We retain your account information and message content for as long as your account is active. When you delete your account, we will delete or anonymize your personal data within 30 days, except where retention is required by law. Server logs and aggregated analytics data may be retained longer in anonymized form.',
  },
  {
    title: '6. Data Security',
    content:
      'We implement industry-standard security measures to protect your data, including encryption in transit (TLS), encrypted storage, secure authentication with JWT tokens and optional MFA, and regular security audits. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.',
  },
  {
    title: '7. Your Rights',
    content:
      'Depending on your jurisdiction, you may have the right to: access and receive a copy of your personal data; correct inaccurate personal data; request deletion of your personal data; object to or restrict processing of your data; data portability. To exercise these rights, contact us at privacy@swiip.app.',
  },
  {
    title: '8. Cookies and Tracking',
    content:
      'We use essential cookies for authentication and session management. We do not use third-party tracking cookies for advertising. You can manage cookie preferences through your browser settings, though disabling essential cookies may affect Service functionality.',
  },
  {
    title: '9. Children\'s Privacy',
    content:
      'The Service is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If we discover that we have collected data from a child under 13, we will promptly delete it.',
  },
  {
    title: '10. International Data Transfers',
    content:
      'Your data may be processed and stored in countries other than your own. We ensure appropriate safeguards are in place for international data transfers in compliance with applicable data protection laws.',
  },
  {
    title: '11. Changes to This Policy',
    content:
      'We may update this Privacy Policy from time to time. We will notify you of significant changes through the Service or via email. Your continued use of the Service after changes take effect constitutes acceptance of the updated policy.',
  },
  {
    title: '12. Contact Us',
    content:
      'For privacy-related inquiries, contact us at privacy@swiip.app. For general support, reach out to support@swiip.app.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen bg-surface-base">
      {/* Background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full"
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
            Privacy Policy
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
