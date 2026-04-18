import { NextRequest, NextResponse } from 'next/server';

// Per-request CSP with a fresh nonce. Mirrors the CSP that Caddy used to set
// (see infra/docker/Caddyfile), but switches script-src from a static allowlist
// to nonce + 'strict-dynamic' so Next.js's emitted inline hydration scripts
// (`self.__next_f.push(...)`, etc.) can run while injected/third-party scripts
// stay blocked. Caddy's CSP header has been removed to avoid conflicts —
// middleware is the single source of truth for CSP now.
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' https: data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self' ws: wss:`,
    `media-src 'self' blob:`,
    `worker-src 'self' blob:`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf)).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
