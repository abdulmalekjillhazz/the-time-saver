import { NextResponse } from 'next/server';

const REDIRECT_PATHS = new Set(['/', '/lessons', '/about', '/help', '/privacy', '/terms']);

// Bangla is the default language, so unprefixed public pages redirect to /bn.
export function proxy(request) {
  const { pathname } = request.nextUrl;
  if (REDIRECT_PATHS.has(pathname)) {
    const target = pathname === '/' ? '/bn' : `/bn${pathname}`;
    return NextResponse.redirect(new URL(target, request.url), 308);
  }
}

export const config = { matcher: ['/', '/lessons', '/about', '/help', '/privacy', '/terms'] };
