import { appendClearAuthCookies } from '@/lib/auth/cookies';
import { jsonResponse } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/auth/logout`
 *
 * The accepted backend exposes no logout/token-blacklist endpoint, so F0
 * termination is client-session termination: both HttpOnly auth cookies are
 * cleared. The refresh token itself stays technically valid until it expires.
 */
export async function POST(): Promise<Response> {
  const headers = new Headers();
  appendClearAuthCookies(headers);
  return jsonResponse({ ok: true }, { status: 200, headers });
}
