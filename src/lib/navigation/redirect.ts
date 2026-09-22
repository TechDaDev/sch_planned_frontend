/**
 * Safe internal redirect handling.
 *
 * `next` values come from the URL, so they are untrusted input: only same-site
 * absolute paths are accepted. Protocol-relative (`//host`), scheme-bearing
 * (`https://`, `javascript:`) and backslash-escaped values are rejected.
 */

export const LOGIN_PATH = '/login';
export const DEFAULT_AUTHENTICATED_PATH = '/dashboard';

const MAX_PATH_LENGTH = 512;

function isSafeInternalPath(value: string): boolean {
  if (value.length === 0 || value.length > MAX_PATH_LENGTH) {
    return false;
  }
  if (!value.startsWith('/')) {
    return false;
  }
  // Protocol-relative ("//evil.example") and backslash variants ("/\evil").
  if (value.startsWith('//') || value.includes('\\')) {
    return false;
  }
  // Control characters can be used to smuggle headers or confuse parsers.
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }
  // A colon before the first slash would indicate a scheme.
  const firstSlash = value.indexOf('/');
  const colon = value.indexOf(':');
  if (colon !== -1 && (firstSlash === -1 || colon < firstSlash)) {
    return false;
  }
  return true;
}

/**
 * Resolve a `next` value into a safe internal path.
 *
 * Falls back to `/dashboard` for anything that is not a plain internal path.
 */
export function safeNextPath(
  candidate: unknown,
  fallback: string = DEFAULT_AUTHENTICATED_PATH,
): string {
  if (typeof candidate !== 'string') {
    return fallback;
  }
  const trimmed = candidate.trim();
  if (isSafeInternalPath(trimmed)) {
    return trimmed;
  }

  // Tolerate a single level of percent-encoding of an otherwise safe path.
  if (trimmed.toLowerCase().includes('%')) {
    try {
      const decoded = decodeURIComponent(trimmed);
      if (isSafeInternalPath(decoded)) {
        return decoded;
      }
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** Build the login URL that preserves the intended destination. */
export function buildLoginUrl(pathname: string, search: string = ''): string {
  const target = safeNextPath(`${pathname}${search}`, DEFAULT_AUTHENTICATED_PATH);
  if (target === DEFAULT_AUTHENTICATED_PATH) {
    return LOGIN_PATH;
  }
  return `${LOGIN_PATH}?next=${encodeURIComponent(target)}`;
}

/** Destination after a successful sign-in: never an external URL. */
export function buildPostLoginPath(next: unknown): string {
  const target = safeNextPath(next, DEFAULT_AUTHENTICATED_PATH);
  return target === LOGIN_PATH ? DEFAULT_AUTHENTICATED_PATH : target;
}
