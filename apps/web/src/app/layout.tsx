import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Fraunces } from 'next/font/google';
import '@/styles/globals.css';
import 'highlight.js/styles/github-dark.css';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

const inter = localFont({
  src: '../fonts/InterVariable.woff2',
  variable: '--font-sans',
  display: 'swap',
  weight: '100 900',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  axes: ['SOFT', 'opsz'],
});

export const metadata: Metadata = {
  title: {
    default: 'Swiip',
    template: '%s — Swiip',
  },
  description: 'Next-generation communication platform',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0C11',
};

import { ServiceWorkerRegistration } from '@/components/providers/ServiceWorkerRegistration';
import { AccentColorSync } from '@/components/providers/AccentColorSync';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${fraunces.variable}`}>
      <body className="bg-surface-base text-text-primary antialiased overflow-x-hidden overflow-y-auto min-h-[100dvh]">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <AccentColorSync />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
