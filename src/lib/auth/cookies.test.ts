import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  appendAuthCookies,
  appendClearAuthCookies,
  buildAuthCookieHeaders,
  buildClearAuthCookieHeaders,
  currentAuthCookieConfigs,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  readAccessToken,
  readCookieValue,
  readRefreshToken,
} from '@/lib/auth/cookies';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('auth cookie configuration', () => {
  it('keeps both tokens in HttpOnly, SameSite=Lax, path=/ cookies', () => {
    const { access, refresh } = currentAuthCookieConfigs();

    for (const config of [access, refresh]) {
      expect(config.httpOnly).toBe(true);
      expect(config.sameSite).toBe('lax');
      expect(config.path).toBe('/');
    }
    expect(access.name).toBe(ACCESS_COOKIE_NAME);
    expect(refresh.name).toBe(REFRESH_COOKIE_NAME);
    expect(access.maxAge).toBe(ACCESS_TOKEN_MAX_AGE_SECONDS);
    expect(refresh.maxAge).toBe(REFRESH_TOKEN_MAX_AGE_SECONDS);
  });

  it('is not Secure outside production and Secure in production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(currentAuthCookieConfigs().access.secure).toBe(false);

    vi.stubEnv('NODE_ENV', 'production');
    expect(currentAuthCookieConfigs().access.secure).toBe(true);
    expect(currentAuthCookieConfigs().refresh.secure).toBe(true);
  });

  it('serializes the expected attributes', () => {
    const [accessCookie] = buildAuthCookieHeaders({ access: 'a.b.c' });
    expect(accessCookie).toContain('sch_access=a.b.c');
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('SameSite=Lax');
    expect(accessCookie).toContain('Path=/');
    expect(accessCookie).toContain(`Max-Age=${ACCESS_TOKEN_MAX_AGE_SECONDS}`);
    expect(accessCookie).not.toContain('Secure');
  });

  it('emits one cookie per token', () => {
    expect(buildAuthCookieHeaders({ access: 'a', refresh: 'r' })).toHaveLength(2);
    expect(buildAuthCookieHeaders({ access: 'a' })).toHaveLength(1);
    expect(buildAuthCookieHeaders({})).toHaveLength(0);
  });

  it('clears both cookies with Max-Age=0', () => {
    const cleared = buildClearAuthCookieHeaders();
    expect(cleared).toHaveLength(2);
    expect(cleared.join(';')).toContain('Max-Age=0');
    expect(cleared[0]).toContain(ACCESS_COOKIE_NAME);
    expect(cleared[1]).toContain(REFRESH_COOKIE_NAME);
  });

  it('appends Set-Cookie headers to a header container', () => {
    const headers = new Headers();
    appendAuthCookies(headers, { access: 'a', refresh: 'r' });
    expect(headers.getSetCookie()).toHaveLength(2);

    const cleared = new Headers();
    appendClearAuthCookies(cleared);
    expect(cleared.getSetCookie()).toHaveLength(2);
  });
});

describe('reading cookies', () => {
  it('parses the token from a Cookie header', () => {
    const header = 'other=1; sch_access=token%2Evalue; sch_refresh=refresh-value';
    expect(readCookieValue(header, ACCESS_COOKIE_NAME)).toBe('token.value');
    expect(readCookieValue(header, REFRESH_COOKIE_NAME)).toBe('refresh-value');
    expect(readCookieValue(header, 'missing')).toBeNull();
    expect(readCookieValue(null, ACCESS_COOKIE_NAME)).toBeNull();
    expect(readCookieValue('sch_access=', ACCESS_COOKIE_NAME)).toBeNull();
  });

  it('reads tokens from an incoming Request', () => {
    const request = new Request('https://planner.test/api/auth/session', {
      headers: { cookie: 'sch_access=access-1; sch_refresh=refresh-1' },
    });
    expect(readAccessToken(request)).toBe('access-1');
    expect(readRefreshToken(request)).toBe('refresh-1');

    const anonymous = new Request('https://planner.test/api/auth/session');
    expect(readAccessToken(anonymous)).toBeNull();
    expect(readRefreshToken(anonymous)).toBeNull();
  });
});
