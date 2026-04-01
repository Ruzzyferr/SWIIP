import type { CookieSerializeOptions } from '@fastify/cookie';

declare module 'fastify' {
  interface FastifyReply {
    setCookie(name: string, value: string, options?: CookieSerializeOptions): this;
    clearCookie(name: string, options?: CookieSerializeOptions): this;
  }

  interface FastifyRequest {
    cookies: Record<string, string | undefined>;
  }
}

export {};
