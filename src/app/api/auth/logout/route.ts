import { appendClearAuthCookies } from '@/lib/auth/cookies';
import { jsonResponse } from '@/lib/http/responses';
import { sameOriginRejectionResponse } from '@/lib/http/same-origin';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/auth/logout`
 *
 * The accepted backend exposes no logout/token-blacklist endpoint, so F0
 * termination is client-session termination: both HttpOnly auth cookies are
 * cleared. The refresh token itself stays technically valid until it expires.
 *
 * A cross-site attempt is rejected: another site must not be able to sign a
 * visitor out.
 */
export async function POST(request: Request): Promise<Response> {
  const crossSite = sameOriginRejectionResponse(request);
  if (crossSite) {
    return crossSite;
  }

  const headers = new Headers();
  appendClearAuthCookies(headers);
  return jsonResponse({ ok: true }, { status: 200, headers });
}
