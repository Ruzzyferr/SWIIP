import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: resolve(__dirname, '../../'),
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/constchat/**',
      },
      {
        protocol: 'https',
        hostname: '*.constchat.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.digitaloceanspaces.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.ondigitalocean.app',
        pathname: '/**',
      },
    ],
  },

  // Rewrite /channels/@me → /channels/me (@ is reserved for parallel routes in Next.js 15+)
  async rewrites() {
    return [
      { source: '/channels/@me', destination: '/channels/me' },
      { source: '/channels/@me/:path*', destination: '/channels/me/:path*' },
    ];
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },

  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@constchat/design-tokens': resolve(
        __dirname,
        '../../packages/design-tokens/src/index.ts'
      ),
      '@constchat/protocol': resolve(
        __dirname,
        '../../packages/protocol/src/index.ts'
      ),
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
