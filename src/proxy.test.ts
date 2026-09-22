import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { config, proxy } from '@/proxy';

const BASE = 'https://planner.test';

function request(path: string, cookies?: string): NextRequest {
  return new NextRequest(`${BASE}${path}`, {
    headers: cookies ? { cookie: cookies } : {},
  });
}

function locationOf(response: Response): string | null {
  return response.headers.get('location');
}

describe('proxy (optimistic cookie check)', () => {
  it('sends an anonymous visitor from a protected route to the login page', () => {
    const response = proxy(request('/dashboard'));

    expect(response.status).toBe(307);
    // /dashboard needs no `next` parameter: it is the default post-login target.
    expect(locationOf(response)).toBe(`${BASE}/login`);
  });

  it('preserves nested destinations and the query string', () => {
    const response = proxy(request('/scheduling/runs?stage=1'));

    expect(locationOf(response)).toBe(
      `${BASE}/login?next=%2Fscheduling%2Fruns%3Fstage%3D1`,
    );
  });

  it('lets a cookie-bearing visitor through', () => {
    const response = proxy(request('/dashboard', 'sch_access=token'));

    expect(response.status).toBe(200);
    expect(locationOf(response)).toBeNull();
  });

  it('accepts a refresh cookie as a session hint', () => {
    const response = proxy(request('/audit', 'sch_refresh=token'));
    expect(response.status).toBe(200);
  });

  it('keeps public routes public', () => {
    const response = proxy(request('/login'));
    expect(response.status).toBe(200);
    expect(locationOf(response)).toBeNull();
  });

  it('redirects an authenticated-looking visitor away from /login', () => {
    const response = proxy(request('/login', 'sch_access=token'));
    expect(locationOf(response)).toBe(`${BASE}/dashboard`);
  });

  it('resolves the root route with a real HTTP redirect', () => {
    expect(locationOf(proxy(request('/')))).toBe(`${BASE}/login`);
    expect(locationOf(proxy(request('/', 'sch_access=token')))).toBe(`${BASE}/dashboard`);
  });

  it('only matches the intended paths', () => {
    expect(config.matcher).toContain('/dashboard/:path*');
    expect(config.matcher).toContain('/login');
    expect(config.matcher).toContain('/');
  });
});
