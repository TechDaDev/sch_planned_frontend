/**
 * Path safety helpers for the generic backend proxy (`/api/backend/[...path]`).
 *
 * The proxy must only ever reach the configured `BACKEND_API_URL`. Everything
 * here rejects path input that could redirect the request elsewhere or escape
 * the API prefix.
 */

const MAX_SEGMENTS = 32;
const MAX_SEGMENT_LENGTH = 256;

/** Django REST endpoints that issue tokens must not be reachable via the proxy. */
const BLOCKED_AUTH_PATHS = ['auth/login', 'auth/refresh'] as const;

export type ProxyPathResult =
  | { ok: true; path: string }
  | { ok: false; reason: 'invalid_path' | 'blocked_endpoint' };

function decodeSegment(segment: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  if (decoded.length === 0 || decoded.length > MAX_SEGMENT_LENGTH) {
    return null;
  }
  if (decoded === '.' || decoded === '..') {
    return null;
  }
  // After decoding, no segment may reintroduce separators, NUL bytes, scheme
  // separators or query/fragment markers.
  if (
    decoded.includes('/') ||
    decoded.includes('\\') ||
    decoded.includes('\0') ||
    decoded.includes(':') ||
    decoded.includes('?') ||
    decoded.includes('#')
  ) {
    return null;
  }
  return decoded;
}

/**
 * Normalize raw route segments into a relative API path.
 *
 * Rejects traversal, encoded separators, scheme/host injection and empty input.
 */
export function resolveProxyPath(segments: readonly string[]): ProxyPathResult {
  if (segments.length === 0 || segments.length > MAX_SEGMENTS) {
    return { ok: false, reason: 'invalid_path' };
  }

  const decodedSegments: string[] = [];
  for (const segment of segments) {
    const decoded = decodeSegment(segment);
    if (decoded === null) {
      return { ok: false, reason: 'invalid_path' };
    }
    decodedSegments.push(decoded);
  }

  const path = decodedSegments.join('/');
  if (isBlockedAuthPath(path)) {
    return { ok: false, reason: 'blocked_endpoint' };
  }
  return { ok: true, path };
}

/**
 * True for the Django token endpoints, which must only be reached by the
 * dedicated auth route handlers.
 */
export function isBlockedAuthPath(path: string): boolean {
  const normalized = path.trim().toLowerCase().replace(/\/+$/, '');
  return BLOCKED_AUTH_PATHS.some(
    (blocked) => normalized === blocked || normalized.startsWith(`${blocked}/`),
  );
}

export type BackendUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: 'invalid_path' | 'blocked_endpoint' | 'invalid_base_url' };

/**
 * Build the absolute Django URL for a proxy request.
 *
 * The result is guaranteed to stay on the configured origin and inside the API
 * prefix; an origin mismatch is treated as a path-safety failure.
 */
export function buildBackendUrl(
  backendApiUrl: string,
  apiPrefix: string,
  segments: readonly string[],
): BackendUrlResult {
  const resolved = resolveProxyPath(segments);
  if (!resolved.ok) {
    return resolved;
  }

  let base: URL;
  try {
    base = new URL(backendApiUrl);
  } catch {
    return { ok: false, reason: 'invalid_base_url' };
  }

  const prefix = apiPrefix.endsWith('/') ? apiPrefix : `${apiPrefix}/`;
  // Django defines every route with a trailing slash, and the router generates
  // its routes the same way. Forwarding the path without it would make Django
  // answer with an APPEND_SLASH redirect that this proxy does not follow - and
  // under DEBUG it refuses a POST outright, losing the body. Adding the slash
  // here means the request reaches the view it was aimed at, on the first call.
  const targetPath = resolved.path.endsWith('/') ? resolved.path : `${resolved.path}/`;
  const url = new URL(`${prefix}${targetPath}`, base);
  if (url.origin !== base.origin) {
    return { ok: false, reason: 'invalid_path' };
  }
  if (!url.pathname.startsWith(new URL(prefix, base).pathname)) {
    return { ok: false, reason: 'invalid_path' };
  }
  return { ok: true, url };
}
