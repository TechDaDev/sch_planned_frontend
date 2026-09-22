import { describe, expect, it } from 'vitest';

import { POST } from '@/app/api/auth/logout/route';
import { installFetchMock } from '@/test/fetch-mock';

const ORIGIN = 'http://localhost:3000';

function logoutRequest(headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/auth/logout`, { method: 'POST', headers });
}

describe('POST /api/auth/logout', () => {
  it('clears both auth cookies and reports success for a same-origin request', async () => {
    const mock = installFetchMock([]);

    const response = await POST(logoutRequest({ origin: ORIGIN }));
    const cookies = response.headers.getSetCookie();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(cookies).toHaveLength(2);
    expect(cookies.join(';')).toContain('sch_access=');
    expect(cookies.join(';')).toContain('sch_refresh=');
    expect(cookies.join(';')).toContain('Max-Age=0');
    expect(cookies.join(';')).toContain('HttpOnly');
    // F0 logout is client-session termination: no backend call exists for it.
    expect(mock.calls).toHaveLength(0);
  });

  it('allows a client that sends no browser headers at all', async () => {
    installFetchMock([]);

    const response = await POST(logoutRequest());

    expect(response.status).toBe(200);
  });

  it('rejects a cross-site request without clearing the session', async () => {
    installFetchMock([]);

    const response = await POST(
      logoutRequest({ 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' }),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(body).toEqual({
      code: 'cross_site_request_rejected',
      detail: 'The request was rejected because it did not originate from this application.',
    });
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it('rejects a request whose Origin does not match the server', async () => {
    installFetchMock([]);

    const response = await POST(logoutRequest({ origin: 'https://evil.example' }));

    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });
});
