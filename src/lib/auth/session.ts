import 'server-only';

/**
 * Session resolution for the BFF.
 *
 * One refresh attempt per resolution, never recursive: a rejected access token
 * triggers at most one `/api/auth/refresh/` call and one `/api/me/` retry.
 */

import {
  requestBackendCurrentUser,
  requestBackendRefresh,
} from '@/lib/auth/backend';
import type { CurrentUser } from '@/lib/auth/types';

export type SessionResolution =
  | { status: 'authenticated'; user: CurrentUser; newAccessToken?: string }
  | {
      status: 'unauthenticated';
      reason: 'no_session' | 'invalid_session' | 'unsupported_role';
    }
  | { status: 'error'; reason: 'backend_unavailable' | 'unexpected_response' };

export interface SessionCredentials {
  accessToken: string | null;
  refreshToken: string | null;
  signal?: AbortSignal;
}

async function tryRefresh(
  refreshToken: string,
  signal?: AbortSignal,
): Promise<
  | { status: 'refreshed'; accessToken: string }
  | { status: 'invalid' }
  | { status: 'error' }
> {
  const refreshed = await requestBackendRefresh(refreshToken, signal);
  if (refreshed.ok) {
    return { status: 'refreshed', accessToken: refreshed.access };
  }
  return refreshed.reason === 'invalid_refresh'
    ? { status: 'invalid' }
    : { status: 'error' };
}

export async function resolveSession(
  credentials: SessionCredentials,
): Promise<SessionResolution> {
  const { accessToken, refreshToken, signal } = credentials;

  if (!accessToken && !refreshToken) {
    return { status: 'unauthenticated', reason: 'no_session' };
  }

  if (accessToken) {
    const identity = await requestBackendCurrentUser(accessToken, signal);
    if (identity.ok) {
      return { status: 'authenticated', user: identity.user };
    }
    if (identity.reason === 'unsupported_role') {
      return { status: 'unauthenticated', reason: 'unsupported_role' };
    }
    if (identity.reason === 'malformed_response') {
      return { status: 'error', reason: 'unexpected_response' };
    }
    if (identity.reason === 'unavailable') {
      return { status: 'error', reason: 'backend_unavailable' };
    }
    // Access token rejected: fall through to a single refresh attempt.
  }

  if (!refreshToken) {
    return { status: 'unauthenticated', reason: 'invalid_session' };
  }

  const refreshed = await tryRefresh(refreshToken, signal);
  if (refreshed.status === 'invalid') {
    return { status: 'unauthenticated', reason: 'invalid_session' };
  }
  if (refreshed.status === 'error') {
    return { status: 'error', reason: 'backend_unavailable' };
  }

  const retried = await requestBackendCurrentUser(refreshed.accessToken, signal);
  if (retried.ok) {
    return {
      status: 'authenticated',
      user: retried.user,
      newAccessToken: refreshed.accessToken,
    };
  }
  if (retried.reason === 'unsupported_role') {
    return { status: 'unauthenticated', reason: 'unsupported_role' };
  }
  if (retried.reason === 'malformed_response') {
    return { status: 'error', reason: 'unexpected_response' };
  }
  if (retried.reason === 'unauthorized') {
    return { status: 'unauthenticated', reason: 'invalid_session' };
  }
  return { status: 'error', reason: 'backend_unavailable' };
}
