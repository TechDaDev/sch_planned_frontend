import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DELETE, GET, POST } from '@/app/api/backend/[...path]/route';
import {
  binaryResponse,
  installFetchMock,
  jsonResponse,
} from '@/test/fetch-mock';

const BACKEND = 'http://backend.test';
/**
 * Django defines every route with a trailing slash, so the proxy addresses it
 * with one. The browser-facing path stays slashless: the client normalizes a
 * proxy path into segments and the proxy composes the upstream URL.
 */
const ROOMS_URL = `${BACKEND}/api/academics/rooms/`;
const REFRESH_URL = `${BACKEND}/api/auth/refresh/`;

beforeEach(() => {
  vi.stubEnv('BACKEND_API_URL', BACKEND);
});

function context(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

function proxyRequest(
  url: string,
  init: RequestInit = {},
): Request {
  return new Request(`https://planner.test${url}`, init);
}

describe('GET /api/backend/[...path]', () => {
  it('adds the bearer token server-side and ignores client credentials', async () => {
    const mock = installFetchMock([
      {
        url: ROOMS_URL,
        method: 'GET',
        handler: () => jsonResponse({ results: [] }),
      },
    ]);

    const response = await GET(
      proxyRequest('/api/backend/academics/rooms', {
        headers: {
          cookie: 'sch_access=server-token',
          authorization: 'Bearer attacker-token',
          host: 'evil.example',
          'x-forwarded-for': '10.0.0.1',
        },
      }),
      context(['academics', 'rooms']),
    );

    expect(response.status).toBe(200);
    const forwarded = new Headers(mock.calls[0]?.init.headers);
    expect(forwarded.get('authorization')).toBe('Bearer server-token');
    expect(forwarded.get('cookie')).toBeNull();
    expect(forwarded.get('host')).toBeNull();
    expect(forwarded.get('x-forwarded-for')).toBeNull();
  });

  it('refuses to expose the Django token endpoints', async () => {
    const mock = installFetchMock([]);

    for (const path of [
      ['auth', 'login'],
      ['auth', 'login', 'extra'],
      ['AUTH', 'REFRESH'],
    ]) {
      const response = await GET(proxyRequest('/api/backend/auth/login'), context(path));
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: 'endpoint_not_proxied' });
    }
    expect(mock.calls).toHaveLength(0);
  });

  it('rejects unsafe paths before any network call', async () => {
    const mock = installFetchMock([]);

    const traversal = await GET(
      proxyRequest('/api/backend/%2e%2e/secret'),
      context(['%2e%2e', 'secret']),
    );
    expect(traversal.status).toBe(400);

    const scheme = await GET(proxyRequest('/api/backend/http:/evil'), context(['http:', 'evil']));
    expect(scheme.status).toBe(400);
    expect(mock.calls).toHaveLength(0);
  });

  it('forwards the query string', async () => {
    const mock = installFetchMock([
      {
        url: `${ROOMS_URL}?page=2&stage=1`,
        method: 'GET',
        handler: () => jsonResponse({ results: [] }),
      },
    ]);

    const response = await GET(
      proxyRequest('/api/backend/academics/rooms?page=2&stage=1', {
        headers: { cookie: 'sch_access=server-token' },
      }),
      context(['academics', 'rooms']),
    );

    expect(response.status).toBe(200);
    expect(mock.callsTo(`${ROOMS_URL}?page=2&stage=1`)).toHaveLength(1);
  });

  it('never invents a token for an anonymous caller', async () => {
    const mock = installFetchMock([
      {
        url: ROOMS_URL,
        method: 'GET',
        handler: () =>
          jsonResponse({ detail: 'Authentication credentials were not provided.' }, 401),
      },
    ]);

    const response = await GET(
      proxyRequest('/api/backend/academics/rooms'),
      context(['academics', 'rooms']),
    );

    const forwarded = new Headers(mock.calls[0]?.init.headers);
    expect(forwarded.get('authorization')).toBeNull();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'unauthenticated' });
  });
});

describe('refresh handling', () => {
  it('refreshes once on 401 and retries the original request', async () => {
    let attempts = 0;
    const mock = installFetchMock([
      {
        url: ROOMS_URL,
        method: 'GET',
        handler: (init) => {
          attempts += 1;
          const authorization = new Headers(init.headers).get('authorization');
          if (authorization === 'Bearer expired-token') {
            return jsonResponse({ detail: 'Token is invalid or expired' }, 401);
          }
          return jsonResponse({ results: [{ id: 1 }] });
        },
      },
      {
        url: REFRESH_URL,
        method: 'POST',
        handler: () => jsonResponse({ access: 'fresh-token' }),
      },
    ]);

    const response = await GET(
      proxyRequest('/api/backend/academics/rooms', {
        headers: { cookie: 'sch_access=expired-token; sch_refresh=refresh-token' },
      }),
      context(['academics', 'rooms']),
    );

    expect(response.status).toBe(200);
    expect(attempts).toBe(2);
    expect(mock.countTo(REFRESH_URL)).toBe(1);
    expect(response.headers.getSetCookie().join(';')).toContain('sch_access=fresh-token');
    expect(await response.json()).toEqual({ results: [{ id: 1 }] });
  });

  it('stops the retry loop after a second 401', async () => {
    const mock = installFetchMock([
      {
        url: ROOMS_URL,
        method: 'GET',
        handler: () => jsonResponse({ detail: 'Token is invalid or expired' }, 401),
      },
      {
        url: REFRESH_URL,
        method: 'POST',
        handler: () => jsonResponse({ access: 'fresh-token' }),
      },
    ]);

    const response = await GET(
      proxyRequest('/api/backend/academics/rooms', {
        headers: { cookie: 'sch_access=expired-token; sch_refresh=refresh-token' },
      }),
      context(['academics', 'rooms']),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'session_expired' });
    expect(mock.countTo(ROOMS_URL)).toBe(2);
    expect(mock.countTo(REFRESH_URL)).toBe(1);
  });

  it('clears cookies when the refresh token is rejected', async () => {
    const mock = installFetchMock([
      {
        url: ROOMS_URL,
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
      proxyRequest('/api/backend/academics/rooms', {
        headers: { cookie: 'sch_access=expired-token; sch_refresh=refresh-token' },
      }),
      context(['academics', 'rooms']),
    );

    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie().join(';')).toContain('Max-Age=0');
    expect(mock.countTo(REFRESH_URL)).toBe(1);
  });

  it('does not refresh when no refresh cookie exists', async () => {
    const mock = installFetchMock([
      {
        url: ROOMS_URL,
        method: 'GET',
        handler: () => jsonResponse({ detail: 'Authentication credentials were not provided.' }, 401),
      },
    ]);

    const response = await GET(
      proxyRequest('/api/backend/academics/rooms', {
        headers: { cookie: 'sch_access=expired-token' },
      }),
      context(['academics', 'rooms']),
    );

    expect(response.status).toBe(401);
    expect(mock.countTo(REFRESH_URL)).toBe(0);
    expect(mock.countTo(ROOMS_URL)).toBe(1);
  });

  it('reports a backend outage as 503', async () => {
    installFetchMock([
      {
        url: ROOMS_URL,
        method: 'GET',
        handler: () => {
          throw new Error('ECONNREFUSED');
        },
      },
    ]);

    const response = await GET(
      proxyRequest('/api/backend/academics/rooms', {
        headers: { cookie: 'sch_access=token' },
      }),
      context(['academics', 'rooms']),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'backend_unavailable' });
  });
});

describe('binary and body handling', () => {
  it('preserves content type, disposition and bytes for downloads', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]); // %PDF
    installFetchMock([
      {
        url: `${BACKEND}/api/reports/1/export/`,
        method: 'GET',
        handler: () =>
          binaryResponse(bytes, 'application/pdf', {
            'content-disposition': 'attachment; filename="timetable.pdf"',
          }),
      },
    ]);

    const response = await GET(
      proxyRequest('/api/backend/reports/1/export', {
        headers: { cookie: 'sch_access=token' },
      }),
      context(['reports', '1', 'export']),
    );

    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('timetable.pdf');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it('forwards a request body and content type', async () => {
    const mock = installFetchMock([
      {
        url: ROOMS_URL,
        method: 'POST',
        handler: () => jsonResponse({ id: 4 }, 201),
      },
    ]);

    const response = await POST(
      proxyRequest('/api/backend/academics/rooms', {
        method: 'POST',
        headers: { cookie: 'sch_access=token', 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Lab 1' }),
      }),
      context(['academics', 'rooms']),
    );

    expect(response.status).toBe(201);
    const forwarded = new Headers(mock.calls[0]?.init.headers);
    expect(forwarded.get('content-type')).toBe('application/json');
    expect(new TextDecoder().decode(mock.calls[0]?.init.body as ArrayBuffer)).toBe(
      JSON.stringify({ name: 'Lab 1' }),
    );
  });

  it('keeps bodyless methods bodyless', async () => {
    const mock = installFetchMock([
      {
        url: `${BACKEND}/api/academics/rooms/4/`,
        method: 'DELETE',
        handler: () => new Response(null, { status: 204 }),
      },
    ]);

    const response = await DELETE(
      proxyRequest('/api/backend/academics/rooms/4', {
        method: 'DELETE',
        headers: { cookie: 'sch_access=token' },
      }),
      context(['academics', 'rooms', '4']),
    );

    expect(response.status).toBe(204);
    expect(mock.calls[0]?.init.body).toBeUndefined();
  });
});
