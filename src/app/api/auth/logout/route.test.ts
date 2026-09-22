import { describe, expect, it } from 'vitest';

import { POST } from '@/app/api/auth/logout/route';
import { installFetchMock } from '@/test/fetch-mock';

describe('POST /api/auth/logout', () => {
  it('clears both auth cookies and reports success', async () => {
    const mock = installFetchMock([]);

    const response = await POST();
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
});
