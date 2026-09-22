import 'server-only';

/**
 * Server-only environment access.
 *
 * `BACKEND_API_URL` intentionally has no `NEXT_PUBLIC_` prefix: the browser
 * must never learn the internal backend URL, and all backend traffic goes
 * through the same-origin BFF route handlers.
 */

const FALLBACK_BACKEND_API_URL = 'http://127.0.0.1:8000';

/** Django mounts its API under this prefix (`config/urls.py`). */
export const BACKEND_API_PREFIX = '/api';

export const BACKEND_REQUEST_TIMEOUT_MS = 15_000;

function stripTrailingSlashes(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function getBackendApiUrl(): string {
  const configured = process.env.BACKEND_API_URL;
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return stripTrailingSlashes(configured);
  }
  return FALLBACK_BACKEND_API_URL;
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Absolute Django URL for an API-relative path such as `me/`. */
export function backendApiUrl(path: string): string {
  const base = getBackendApiUrl();
  const prefix = BACKEND_API_PREFIX;
  return `${base}${prefix}/${path.replace(/^\/+/, '')}`;
}

export function backendRequestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(BACKEND_REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
