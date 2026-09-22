import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/auth/login/route';
import {
  currentUserPayload,
  installFetchMock,
  jsonResponse,
  tokenPairResponse,
} from '@/test/fetch-mock';

const BACKEND = 'http://backend.test';
const LOGIN_URL = `${BACKEND}/api/auth/login/`;
const ME_URL = `${BACKEND}/api/me/`;

beforeEach(() => {
  vi.stubEnv('BACKEND_API_URL', BACKEND);
});

function loginRequest(body: unknown, raw?: string): Request {
  return new Request('https://planner.test/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  it('stores both tokens as HttpOnly cookies and returns only the user', async () => {
    const mock = installFetchMock([
      { url: LOGIN_URL, method: 'POST', handler: () => tokenPairResponse() },
      { url: ME_URL, method: 'GET', handler: () => jsonResponse(currentUserPayload()) },
    ]);

    const response = await POST(loginRequest({ username: 'r.salim', password: 'secret' }));
    const rawBody = await response.text();
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(parsed.user).toMatchObject({ username: 'r.salim', role: 'SCHEDULER' });

    // No token, no Authorization header, no session internals in the response.
    expect(parsed).not.toHaveProperty('access');
    expect(parsed).not.toHaveProperty('refresh');
    expect(rawBody).not.toContain('access-token-1');
    expect(rawBody).not.toContain('refresh-token-1');
    expect(rawBody.toLowerCase()).not.toContain('bearer');

    const cookies = response.headers.getSetCookie();
    expect(cookies.join(';')).toContain('sch_access=');
    expect(cookies.join(';')).toContain('sch_refresh=');
    expect(cookies.join(';')).toContain('HttpOnly');
    expect(response.headers.get('cache-control')).toContain('no-store');

    // The identity lookup uses the freshly issued access token server-side.
    const meCall = mock.callsTo(ME_URL)[0];
    expect(new Headers(meCall?.init.headers).get('authorization')).toBe(
      'Bearer access-token-1',
    );
  });

  it('rejects invalid credentials without setting cookies', async () => {
    installFetchMock([
      {
        url: LOGIN_URL,
        method: 'POST',
        handler: () => jsonResponse({ detail: 'No active account found.' }, 401),
      },
    ]);

    const response = await POST(loginRequest({ username: 'r.salim', password: 'wrong' }));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(body.code).toBe('invalid_credentials');
    expect(body.detail).toBe('Invalid username or password.');
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it('validates the request shape', async () => {
    const mock = installFetchMock([]);

    const malformed = await POST(loginRequest({}, 'not-json'));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ code: 'invalid_request' });

    const missingPassword = await POST(loginRequest({ username: 'r.salim' }));
    expect(missingPassword.status).toBe(400);

    const blank = await POST(loginRequest({ username: '   ', password: 'secret' }));
    expect(blank.status).toBe(400);

    expect(mock.calls).toHaveLength(0);
  });

  it('refuses to create a session for an unsupported role', async () => {
    installFetchMock([
      { url: LOGIN_URL, method: 'POST', handler: () => tokenPairResponse() },
      {
        url: ME_URL,
        method: 'GET',
        handler: () => jsonResponse(currentUserPayload({ role: 'ADMIN' })),
      },
    ]);

    const response = await POST(loginRequest({ username: 'r.salim', password: 'secret' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'unsupported_role' });
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it('reports an unreachable authentication service without leaking details', async () => {
    installFetchMock([
      {
        url: LOGIN_URL,
        method: 'POST',
        handler: () => {
          throw new Error('ECONNREFUSED 127.0.0.1:8000');
        },
      },
    ]);

    const response = await POST(loginRequest({ username: 'r.salim', password: 'secret' }));
    const raw = await response.text();

    expect(response.status).toBe(503);
    expect(raw).not.toContain('ECONNREFUSED');
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });
});
