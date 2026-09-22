import {
  appendAuthCookies,
  appendClearAuthCookies,
  readAccessToken,
  readRefreshToken,
} from '@/lib/auth/cookies';
import { resolveSession } from '@/lib/auth/session';
import { errorResponse, jsonResponse } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/auth/session`
 *
 * Restores the session from the HttpOnly cookies. A rejected access token
 * triggers exactly one refresh attempt (and one `/api/me/` retry) before the
 * caller is told the session is gone.
 */
export async function GET(request: Request): Promise<Response> {
  const resolution = await resolveSession({
    accessToken: readAccessToken(request),
    refreshToken: readRefreshToken(request),
  });

  if (resolution.status === 'authenticated') {
    const headers = new Headers();
    if (resolution.newAccessToken) {
      appendAuthCookies(headers, { access: resolution.newAccessToken });
    }
    return jsonResponse({ user: resolution.user }, { status: 200, headers });
  }

  if (resolution.status === 'error') {
    // The session may still be valid: the backend was unreachable. Cookies are
    // deliberately left untouched so the user is not signed out by an outage.
    return errorResponse(
      503,
      'backend_unavailable',
      'The session could not be verified because the server is temporarily unavailable.',
    );
  }

  const headers = new Headers();
  if (resolution.reason === 'unsupported_role') {
    appendClearAuthCookies(headers);
    return errorResponse(
      401,
      'unsupported_role',
      'This account role is not supported by this application.',
      headers,
    );
  }

  if (resolution.reason === 'invalid_session') {
    appendClearAuthCookies(headers);
    return errorResponse(
      401,
      'session_expired',
      'Your session has expired. Please sign in again.',
      headers,
    );
  }

  return errorResponse(
    401,
    'unauthenticated',
    'No active session was found.',
    headers,
  );
}
