import { NextResponse, type NextRequest } from 'next/server';

import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth/cookies';
import { isProtectedPath } from '@/lib/navigation/protected-paths';
import { buildLoginUrl, LOGIN_PATH } from '@/lib/navigation/redirect';

/**
 * Next.js 16 Proxy (the renamed Middleware).
 *
 * This is an optimistic, fast cookie-presence check only. It runs before the
 * server can validate a session, so it must never be treated as authorization:
 * the BFF route handlers and Django remain authoritative.
 */

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie =
    request.cookies.has(ACCESS_COOKIE_NAME) || request.cookies.has(REFRESH_COOKIE_NAME);

  // The landing route must never be a blank page: issue a real HTTP redirect
  // instead of a client-side one.
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(hasSessionCookie ? '/dashboard' : '/login', request.url),
    );
  }

  if (isProtectedPath(pathname) && !hasSessionCookie) {
    const loginUrl = new URL(buildLoginUrl(pathname, search), request.url);
    return NextResponse.redirect(loginUrl);
  }

  // An authenticated-looking visitor is sent away from /login; the session
  // endpoint rejects stale cookies, so this cannot loop indefinitely.
  if (pathname === LOGIN_PATH && hasSessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

/**
 * The matcher must be statically analyzable, so it repeats the prefix list rather than
 * deriving it. `protected-paths.test.ts` fails if the two ever drift apart.
 */
export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/academic/:path*',
    '/resources/:path*',
    '/scheduling/:path*',
    '/published/:path*',
    '/reports/:path*',
    '/audit/:path*',
    '/imports/:path*',
    '/my-timetable/:path*',
    '/forbidden/:path*',
    '/login',
  ],
};
