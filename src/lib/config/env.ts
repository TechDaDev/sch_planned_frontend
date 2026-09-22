import 'server-only';

/**
 * Server-only environment access.
 *
 * `BACKEND_API_URL` intentionally has no `NEXT_PUBLIC_` prefix: the browser must
 * never learn the internal backend URL, and all backend traffic goes through the
 * same-origin BFF route handlers.
 *
 * Development may fall back to a local Django server so the application runs out
 * of the box. A production process must be configured explicitly: silently
 * targeting localhost there would not reach a real backend and would hide a
 * deployment mistake, so a missing or invalid value fails closed instead.
 */

const DEVELOPMENT_FALLBACK_BACKEND_API_URL = 'http://127.0.0.1:8000';

/** Django mounts its API under this prefix (`config/urls.py`). */
export const BACKEND_API_PREFIX = '/api';

/**
 * Default backend request timeout.
 *
 * Solver-backed generation is legitimately slow, so the policy is per-endpoint
 * rather than global. Every value is finite: a backend that never answers must not
 * hold a browser request open forever.
 */
export const BACKEND_REQUEST_TIMEOUT_MS = 30_000;

/** Generation and draft endpoints run the solver, which has its own time limit. */
export const BACKEND_GENERATION_TIMEOUT_MS = 15 * 60_000;

/** Readiness probes must answer quickly; they are not allowed to hang. */
export const BACKEND_READINESS_TIMEOUT_MS = 3_000;

/**
 * A production configuration problem.
 *
 * The message is for the server log only. It never becomes the body of a
 * browser-facing response, so it may name the variable that is wrong and must never
 * contain the configured value, a token or a filesystem path.
 */
export class ServerConfigurationError extends Error {
  readonly variable: string;

  constructor(variable: string, message: string) {
    super(message);
    this.name = 'ServerConfigurationError';
    this.variable = variable;
  }
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

function stripTrailingSlashes(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * Validate the configured backend base URL.
 *
 * Accepted: an absolute `http`/`https` URL with a host, no embedded credentials and
 * no fragment. A trailing slash is normalized away. A rejected value is reported as
 * a configuration error and never echoed back.
 */
function parseBackendApiUrl(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  if (parsed.hostname.length === 0) {
    return null;
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return null;
  }
  if (parsed.hash.length > 0) {
    return null;
  }
  return stripTrailingSlashes(parsed.toString());
}

export function getBackendApiUrl(): string {
  const configured = process.env.BACKEND_API_URL;
  const hasValue = typeof configured === 'string' && configured.trim().length > 0;

  if (!hasValue) {
    if (isProductionRuntime()) {
      throw new ServerConfigurationError(
        'BACKEND_API_URL',
        'BACKEND_API_URL must be set in a production runtime; no backend host is assumed.',
      );
    }
    return DEVELOPMENT_FALLBACK_BACKEND_API_URL;
  }

  const normalized = parseBackendApiUrl(configured);
  if (normalized === null) {
    throw new ServerConfigurationError(
      'BACKEND_API_URL',
      'BACKEND_API_URL must be an absolute http(s) URL with a host, without embedded credentials or a fragment.',
    );
  }
  return normalized;
}

/**
 * Whether a usable backend URL is configured, without throwing.
 *
 * Health and error paths use it to report a configuration problem as a controlled
 * failure instead of an exception.
 */
export function hasUsableBackendApiUrl(): boolean {
  try {
    getBackendApiUrl();
    return true;
  } catch {
    return false;
  }
}

/** Absolute Django URL for an API-relative path such as `me/`. */
export function backendApiUrl(path: string): string {
  const base = getBackendApiUrl();
  const prefix = BACKEND_API_PREFIX;
  return `${base}${prefix}/${path.replace(/^\/+/, '')}`;
}

/**
 * Timeout for one backend request.
 *
 * Solver-backed generation and draft persistence may run for minutes; every other
 * call uses the ordinary timeout.
 */
export function backendTimeoutMs(path: string): number {
  const normalized = path.replace(/^\/+/, '').split('?')[0] ?? '';
  const isGeneration =
    normalized.startsWith('scheduling/generate') ||
    normalized.startsWith('schedules/generate');
  return isGeneration ? BACKEND_GENERATION_TIMEOUT_MS : BACKEND_REQUEST_TIMEOUT_MS;
}

export function backendRequestSignal(path: string, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(backendTimeoutMs(path));
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
