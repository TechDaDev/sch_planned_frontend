import 'server-only';

/**
 * Server-side Django REST client used by the BFF route handlers.
 *
 * Only this layer knows how to talk to Django; the browser never receives a
 * token, an Authorization header, or a raw backend error.
 */

import {
  backendApiUrl,
  backendRequestSignal,
} from '@/lib/config/env';
import { parseCurrentUser, type CurrentUser } from '@/lib/auth/types';

export interface LoginTokens {
  access: string;
  refresh: string;
}

export type BackendLoginResult =
  | { ok: true; tokens: LoginTokens }
  | { ok: false; reason: 'invalid_credentials' | 'unavailable' };

export type BackendIdentityResult =
  | { ok: true; user: CurrentUser }
  | {
      ok: false;
      reason:
        | 'unauthorized'
        | 'unsupported_role'
        | 'malformed_response'
        | 'unavailable';
    };

export type BackendRefreshResult =
  | { ok: true; access: string }
  | { ok: false; reason: 'invalid_refresh' | 'unavailable' };

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function readToken(payload: unknown, key: string): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** `POST /api/auth/login/` - the backend returns tokens only. */
export async function requestBackendLogin(
  username: string,
  password: string,
  signal?: AbortSignal,
): Promise<BackendLoginResult> {
  let response: Response;
  try {
    response = await fetch(backendApiUrl('auth/login/'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
      signal: backendRequestSignal(signal),
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (response.status === 401 || response.status === 400) {
    return { ok: false, reason: 'invalid_credentials' };
  }
  if (!response.ok) {
    return { ok: false, reason: 'unavailable' };
  }

  const payload = await readJsonBody(response);
  const access = readToken(payload, 'access');
  const refresh = readToken(payload, 'refresh');
  if (!access || !refresh) {
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true, tokens: { access, refresh } };
}

/** `GET /api/me/` with a bearer access token. */
export async function requestBackendCurrentUser(
  accessToken: string,
  signal?: AbortSignal,
): Promise<BackendIdentityResult> {
  let response: Response;
  try {
    response = await fetch(backendApiUrl('me/'), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal: backendRequestSignal(signal),
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'unauthorized' };
  }
  if (!response.ok) {
    return { ok: false, reason: 'unavailable' };
  }

  const parsed = parseCurrentUser(await readJsonBody(response));
  return parsed.ok ? { ok: true, user: parsed.user } : parsed;
}

/** `POST /api/auth/refresh/` - the backend returns a new access token only. */
export async function requestBackendRefresh(
  refreshToken: string,
  signal?: AbortSignal,
): Promise<BackendRefreshResult> {
  let response: Response;
  try {
    response = await fetch(backendApiUrl('auth/refresh/'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
      cache: 'no-store',
      signal: backendRequestSignal(signal),
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  if (response.status === 401 || response.status === 400) {
    return { ok: false, reason: 'invalid_refresh' };
  }
  if (!response.ok) {
    return { ok: false, reason: 'unavailable' };
  }

  const access = readToken(await readJsonBody(response), 'access');
  if (!access) {
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true, access };
}
