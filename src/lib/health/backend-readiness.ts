import 'server-only';

/**
 * Backend readiness probe used by the frontend readiness endpoint.
 *
 * The request is server-to-server, so the backend host stays on the server. The
 * result is reduced to a boolean and a status code: the backend's own body, its
 * exception strings and any infrastructure detail are never forwarded to the caller.
 */

import {
  BACKEND_API_PREFIX,
  BACKEND_READINESS_TIMEOUT_MS,
  ServerConfigurationError,
  getBackendApiUrl,
} from '@/lib/config/env';

export type BackendReadiness = 'ready' | 'unavailable' | 'misconfigured';

/** Whether Django's readiness endpoint reports `status: ok` with HTTP 200. */
export async function checkBackendReadiness(): Promise<BackendReadiness> {
  let url: string;
  try {
    url = `${getBackendApiUrl()}${BACKEND_API_PREFIX}/health/ready/`;
  } catch (error) {
    if (error instanceof ServerConfigurationError) {
      return 'misconfigured';
    }
    return 'unavailable';
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(BACKEND_READINESS_TIMEOUT_MS),
    });
    if (response.status !== 200) {
      return 'unavailable';
    }
    const payload = (await response.json()) as unknown;
    const status =
      typeof payload === 'object' && payload !== null
        ? (payload as { status?: unknown }).status
        : undefined;
    return status === 'ok' ? 'ready' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
