import {
  requestBackendCurrentUser,
  requestBackendLogin,
} from '@/lib/auth/backend';
import { appendAuthCookies } from '@/lib/auth/cookies';
import {
  errorResponse,
  isPlainRecord,
  jsonResponse,
  readJsonRequest,
  readNonEmptyString,
} from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/auth/login`
 *
 * Same-origin sign-in endpoint. It exchanges credentials with Django, stores
 * both JWTs in HttpOnly cookies and returns only safe session data. Tokens,
 * Authorization headers and raw backend errors never reach the browser.
 */
export async function POST(request: Request): Promise<Response> {
  const payload = await readJsonRequest(request);
  if (!isPlainRecord(payload)) {
    return errorResponse(
      400,
      'invalid_request',
      'A JSON body with "username" and "password" is required.',
    );
  }

  const username = readNonEmptyString(payload, 'username');
  const password = readNonEmptyString(payload, 'password');
  if (!username || !password) {
    return errorResponse(400, 'invalid_request', 'Username and password are required.');
  }

  const login = await requestBackendLogin(username, password);
  if (!login.ok) {
    if (login.reason === 'invalid_credentials') {
      return errorResponse(401, 'invalid_credentials', 'Invalid username or password.');
    }
    return errorResponse(
      503,
      'backend_unavailable',
      'The authentication service is temporarily unavailable. Please try again.',
    );
  }

  const identity = await requestBackendCurrentUser(login.tokens.access);
  if (!identity.ok) {
    if (identity.reason === 'unsupported_role') {
      return errorResponse(
        403,
        'unsupported_role',
        'This account role is not supported by this application.',
      );
    }
    // Do not persist a partial session: no cookies are set when the identity
    // lookup fails.
    return errorResponse(
      503,
      'backend_unavailable',
      'The authentication service is temporarily unavailable. Please try again.',
    );
  }

  const headers = new Headers();
  appendAuthCookies(headers, {
    access: login.tokens.access,
    refresh: login.tokens.refresh,
  });

  return jsonResponse({ user: identity.user }, { status: 200, headers });
}
