'use server';

import { cookies } from 'next/headers';

export type Locale = 'tr' | 'en';

export async function setLocale(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  });
}

export async function getStoredLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return (cookieStore.get('locale')?.value as Locale) || 'tr';
}
