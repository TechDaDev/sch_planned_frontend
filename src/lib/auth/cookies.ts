/**
 * Centralized authentication cookie policy.
 *
 * Both JWTs live in HttpOnly cookies owned by the Next.js server. Token values
 * are never returned to browser JavaScript and never stored in
 * localStorage/sessionStorage/IndexedDB.
 *
 * This module is deliberately free of Next.js imports so the policy can be
 * unit tested directly.
 */

export const ACCESS_COOKIE_NAME = 'sch_access';
export const REFRESH_COOKIE_NAME = 'sch_refresh';

/** Aligned with the accepted backend's SimpleJWT configuration. */
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 30 * 60;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const AUTH_COOKIE_PATH = '/';

export interface AuthCookieConfig {
  name: string;
  maxAge: number;
  httpOnly: true;
  sameSite: 'lax';
  path: string;
  secure: boolean;
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function accessCookieConfig(): AuthCookieConfig {
  return {
    name: ACCESS_COOKIE_NAME,
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    path: AUTH_COOKIE_PATH,
    secure: isProductionRuntime(),
  };
}

export function refreshCookieConfig(): AuthCookieConfig {
  return {
    name: REFRESH_COOKIE_NAME,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    path: AUTH_COOKIE_PATH,
    secure: isProductionRuntime(),
  };
}

/** Cookie config used to delete an auth cookie (`Max-Age=0`). */
export function clearedCookieConfig(name: string): AuthCookieConfig {
  return {
    name,
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    path: AUTH_COOKIE_PATH,
    secure: isProductionRuntime(),
  };
}

/** Both cookie configurations, evaluated against the current environment. */
export function currentAuthCookieConfigs(): {
  access: AuthCookieConfig;
  refresh: AuthCookieConfig;
} {
  return { access: accessCookieConfig(), refresh: refreshCookieConfig() };
}

export function serializeAuthCookie(config: AuthCookieConfig, value: string): string {
  const parts = [
    `${config.name}=${encodeURIComponent(value)}`,
    `Max-Age=${config.maxAge}`,
    `Path=${config.path}`,
    'HttpOnly',
    `SameSite=${config.sameSite === 'lax' ? 'Lax' : config.sameSite}`,
  ];
  if (config.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export interface AuthTokenPair {
  access?: string;
  refresh?: string;
}/** `Set-Cookie` values that persist the supplied tokens. */
export function buildAuthCookieHeaders(tokens: AuthTokenPair): string[] {
  const headers: string[] = [];
  if (typeof tokens.access === 'string' && tokens.access.length > 0) {
    headers.push(serializeAuthCookie(accessCookieConfig(), tokens.access));
  }
  if (typeof tokens.refresh === 'string' && tokens.refresh.length > 0) {
    headers.push(serializeAuthCookie(refreshCookieConfig(), tokens.refresh));
  }
  return headers;
}

/** `Set-Cookie` values that expire both auth cookies. */
export function buildClearAuthCookieHeaders(): string[] {
  return [
    serializeAuthCookie(clearedCookieConfig(ACCESS_COOKIE_NAME), ''),
    serializeAuthCookie(clearedCookieConfig(REFRESH_COOKIE_NAME), ''),
  ];
}

/** Read one cookie value from a raw `Cookie` header. */
export function readCookieValue(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }
    const rawValue = part.slice(separator + 1).trim();
    if (rawValue.length === 0) {
      return null;
    }
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }
  return null;
}

export function readAccessToken(request: Request): string | null {
  return readCookieValue(request.headers.get('cookie'), ACCESS_COOKIE_NAME);
}

export function readRefreshToken(request: Request): string | null {
  return readCookieValue(request.headers.get('cookie'), REFRESH_COOKIE_NAME);
}

/** Apply `Set-Cookie` headers to a header container. */
export function appendAuthCookies(headers: Headers, tokens: AuthTokenPair): void {
  for (const cookie of buildAuthCookieHeaders(tokens)) {
    headers.append('set-cookie', cookie);
  }
}

/** Expire both auth cookies on the supplied response headers. */
export function appendClearAuthCookies(headers: Headers): void {
  for (const cookie of buildClearAuthCookieHeaders()) {
    headers.append('set-cookie', cookie);
  }
}
