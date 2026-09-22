import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth/cookies';
import { DEFAULT_AUTHENTICATED_PATH, LOGIN_PATH } from '@/lib/navigation/redirect';

/**
 * Root route.
 *
 * Sends visitors straight to the operational surface of the application: the
 * dashboard when an auth cookie is present, otherwise the login page. The
 * cookie check is optimistic only; the dashboard itself validates the session
 * server-side.
 */
export default async function RootPage() {
  const cookieStore = await cookies();
  const hasSessionCookie =
    cookieStore.has(ACCESS_COOKIE_NAME) || cookieStore.has(REFRESH_COOKIE_NAME);

  redirect(hasSessionCookie ? DEFAULT_AUTHENTICATED_PATH : LOGIN_PATH);
}
