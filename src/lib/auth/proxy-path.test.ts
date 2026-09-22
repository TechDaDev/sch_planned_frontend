import { describe, expect, it } from 'vitest';

import {
  buildBackendUrl,
  isBlockedAuthPath,
  resolveProxyPath,
} from '@/lib/auth/proxy-path';

const BACKEND = 'http://127.0.0.1:8000';
const PREFIX = '/api';

describe('resolveProxyPath', () => {
  it('joins valid segments', () => {
    expect(resolveProxyPath(['academics', 'rooms'])).toEqual({
      ok: true,
      path: 'academics/rooms',
    });
    expect(resolveProxyPath(['reports', '42', 'export'])).toEqual({
      ok: true,
      path: 'reports/42/export',
    });
  });

  it('rejects traversal and encoded separators', () => {
    for (const segments of [
      ['..', 'secret'],
      ['%2e%2e', 'secret'],
      ['academics', '..'],
      ['%2e%2e%2f%2e%2e%2fadmin'],
      ['academics%2Frooms'],
      ['..%2F..%2Fetc'],
      ['academics\\rooms'],
      [''],
      [],
      ['academics', ''],
    ]) {
      expect(resolveProxyPath(segments).ok).toBe(false);
    }
  });

  it('rejects scheme, host and query injection attempts', () => {
    for (const segments of [
      ['https:', 'evil.example'],
      ['//evil.example'],
      ['http://evil.example'],
      ['academics?admin=1'],
      ['academics#fragment'],
      ['%00'],
    ]) {
      expect(resolveProxyPath(segments).ok).toBe(false);
    }
  });

  it('rejects absurdly deep paths', () => {
    const many = Array.from({ length: 40 }, (_, index) => `segment-${index}`);
    expect(resolveProxyPath(many).ok).toBe(false);
  });

  it('blocks the Django token endpoints', () => {
    expect(resolveProxyPath(['auth', 'login'])).toEqual({
      ok: false,
      reason: 'blocked_endpoint',
    });
    expect(resolveProxyPath(['auth', 'refresh'])).toEqual({
      ok: false,
      reason: 'blocked_endpoint',
    });
    expect(resolveProxyPath(['auth', 'login', 'extra']).ok).toBe(false);
    expect(isBlockedAuthPath('AUTH/LOGIN/')).toBe(true);
    expect(isBlockedAuthPath('auth/me')).toBe(false);
    expect(isBlockedAuthPath('academics/auth/login-notes')).toBe(false);
  });
});

describe('buildBackendUrl', () => {
  it('always targets the configured origin and API prefix', () => {
    const result = buildBackendUrl(BACKEND, PREFIX, ['academics', 'rooms']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.toString()).toBe('http://127.0.0.1:8000/api/academics/rooms/');
      expect(result.url.origin).toBe(new URL(BACKEND).origin);
    }
  });

  it('tolerates a trailing slash on the configured base URL', () => {
    const result = buildBackendUrl('http://backend.internal:9000/', PREFIX, ['me']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.toString()).toBe('http://backend.internal:9000/api/me/');
    }
  });

  it('addresses every Django route with its trailing slash', () => {
    // Django defines all of these with a trailing slash; a slashless request
    // would be answered with a redirect that the proxy does not follow, and a
    // POST would be refused outright while running with DEBUG enabled.
    for (const segments of [
      ['colleges'],
      ['colleges', '7'],
      ['scheduling', 'validate'],
      ['scheduling', 'generate-college'],
      ['schedules', 'generate-department-draft'],
      ['schedules', '300', 'versions'],
      ['schedule-versions', '501', 'entries'],
    ]) {
      const result = buildBackendUrl(BACKEND, PREFIX, segments);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.url.pathname.endsWith('/')).toBe(true);
        expect(result.url.pathname).toBe(`/api/${segments.join('/')}/`);
      }
    }
  });

  it('refuses unsafe paths and invalid base URLs', () => {
    expect(buildBackendUrl(BACKEND, PREFIX, ['..', 'admin']).ok).toBe(false);
    expect(buildBackendUrl(BACKEND, PREFIX, ['auth', 'login'])).toEqual({
      ok: false,
      reason: 'blocked_endpoint',
    });
    expect(buildBackendUrl('not-a-url', PREFIX, ['me'])).toEqual({
      ok: false,
      reason: 'invalid_base_url',
    });
  });
});
