import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/auth/session/route';
import {
  currentUserPayload,
  installFetchMock,
  jsonResponse,
} from '@/test/fetch-mock';

const BACKEND = 'http://backend.test';
const ME_URL = `${BACKEND}/api/me/`;
const REFRESH_URL = `${BACKEND}/api/auth/refresh/`;

beforeEach(() => {
  vi.stubEnv('BACKEND_API_URL', BACKEND);
});

function sessionRequest(cookies?: string): Request {
  return new Request('https://planner.test/api/auth/session', {
    headers: cookies ? { cookie: cookies } : {},
  });
}

describe('GET /api/auth/session', () => {
  it('reports an anonymous visitor without touching the backend', async () => {
    const mock = installFetchMock([]);

    const response = await GET(sessionRequest());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'unauthenticated' });
    expect(mock.calls).toHaveLength(0);
  });

  it('returns the current user for a valid access token', async () => {
    installFetchMock([
      { url: ME_URL, method: 'GET', handler: () => jsonResponse(currentUserPayload()) },
    ]);

    const response = await GET(sessionRequest('sch_access=access-token-1'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { username: 'r.salim', department: { code: 'CS' } },
    });
    // The access cookie is still valid: nothing is reissued.
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it('refreshes exactly once and updates the access cookie', async () => {
    const mock = installFetchMock([
      {
        url: ME_URL,
        method: 'GET',
        handler: (init) =>
          new Headers(init.headers).get('authorization') === 'Bearer access-token-1'
            ? jsonResponse({ detail: 'Token is invalid or expired' }, 401)
            : jsonResponse(currentUserPayload()),
      },
      {
        url: REFRESH_URL,
        method: 'POST',
        handler: () => jsonResponse({ access: 'access-token-2' }),
      },
    ]);

    const response = await GET(
      sessionRequest('sch_access=access-token-1; sch_refresh=refresh-token-1'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { username: 'r.salim' } });
    expect(mock.countTo(REFRESH_URL)).toBe(1);
    expect(mock.countTo(ME_URL)).toBe(2);
    expect(response.headers.getSetCookie().join(';')).toContain('sch_access=access-token-2');
  });

  it('stops after one refresh attempt even if the retry is rejected', async () => {
    const mock = installFetchMock([
      {
        url: ME_URL,
        method: 'GET',
        handler: () => jsonResponse({ detail: 'Token is invalid or expired' }, 401),
      },
      {
        url: REFRESH_URL,
        method: 'POST',
        handler: () => jsonResponse({ access: 'access-token-2' }),
      },
    ]);

    const response = await GET(
      sessionRequest('sch_access=access-token-1; sch_refresh=refresh-token-1'),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'session_expired' });
    expect(mock.countTo(REFRESH_URL)).toBe(1);
    expect(mock.countTo(ME_URL)).toBe(2);
  });

  it('clears both cookies when the refresh token is rejected', async () => {
    installFetchMock([
      {
        url: ME_URL,
        method: 'GET',
        handler: () => jsonResponse({ detail: 'Token is invalid or expired' }, 401),
      },
      {
        url: REFRESH_URL,
        method: 'POST',
        handler: () => jsonResponse({ detail: 'Token is invalid or expired' }, 401),
      },
    ]);

    const response = await GET(
      sessionRequest('sch_access=access-token-1; sch_refresh=refresh-token-1'),
    );
    const cookies = response.headers.getSetCookie();

    expect(response.status).toBe(401);
    expect(cookies).toHaveLength(2);
    expect(cookies.join(';')).toContain('Max-Age=0');
  });

  it('clears the access cookie when a refresh token exists but no access token does', async () => {
    installFetchMock([
      { url: ME_URL, method: 'GET', handler: () => jsonResponse(currentUserPayload()) },
      {
        url: REFRESH_URL,
        method: 'POST',
        handler: () => jsonResponse({ access: 'access-token-9' }),
      },
    ]);

    const response = await GET(sessionRequest('sch_refresh=refresh-token-1'));
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join(';')).toContain('sch_access=access-token-9');
  });

  it('rejects an unsupported role and clears the session cookies', async () => {
    installFetchMock([
      {
        url: ME_URL,
        method: 'GET',
        handler: () => jsonResponse(currentUserPayload({ role: 'STAFF' })),
      },
    ]);

    const response = await GET(sessionRequest('sch_access=access-token-1'));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'unsupported_role' });
    expect(response.headers.getSetCookie().join(';')).toContain('Max-Age=0');
  });

  it('reports an outage without signing the user out', async () => {
    installFetchMock([
      {
        url: ME_URL,
        method: 'GET',
        handler: () => {
          throw new Error('ECONNREFUSED');
        },
      },
    ]);

    const response = await GET(sessionRequest('sch_access=access-token-1'));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'backend_unavailable' });
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it('surfaces a malformed /api/me/ payload as a backend problem, not a login', async () => {
    installFetchMock([
      {
        url: ME_URL,
        method: 'GET',
        handler: () => jsonResponse({ id: 'not-a-number', username: 42 }),
      },
    ]);

    const response = await GET(sessionRequest('sch_access=access-token-1'));
    expect(response.status).toBe(503);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it('rejects a stale access token without a refresh cookie', async () => {
    const mock = installFetchMock([
      {
        url: ME_URL,
        method: 'GET',
        handler: () => jsonResponse({ detail: 'Token is invalid or expired' }, 401),
      },
    ]);

    const response = await GET(sessionRequest('sch_access=access-token-1'));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'session_expired' });
    expect(mock.countTo(ME_URL)).toBe(1);
    expect(response.headers.getSetCookie().join(';')).toContain('Max-Age=0');
  });
});
