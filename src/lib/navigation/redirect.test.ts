import { describe, expect, it } from 'vitest';

import {
  buildLoginUrl,
  buildPostLoginPath,
  safeNextPath,
} from '@/lib/navigation/redirect';

describe('safeNextPath', () => {
  it('keeps internal paths', () => {
    expect(safeNextPath('/scheduling')).toBe('/scheduling');
    expect(safeNextPath('/audit/records')).toBe('/audit/records');
    expect(safeNextPath('  /dashboard  ')).toBe('/dashboard');
  });

  it('rejects external and protocol-relative targets', () => {
    for (const candidate of [
      'https://evil.example/steal',
      'http://evil.example',
      '//evil.example',
      'javascript:alert(1)',
      'data:text/html,<script>',
      '/\\evil.example',
      '\\\\evil.example',
      '',
      'dashboard',
      null,
      undefined,
      42,
    ]) {
      expect(safeNextPath(candidate)).toBe('/dashboard');
    }
  });

  it('rejects percent-encoded external targets', () => {
    expect(safeNextPath('%2F%2Fevil.example')).toBe('/dashboard');
    expect(safeNextPath('%68%74%74%70%73%3A%2F%2Fevil.example')).toBe('/dashboard');
  });

  it('rejects control characters', () => {
    expect(safeNextPath('/dashboard\u0000')).toBe('/dashboard');
  });

  it('honours a custom fallback', () => {
    expect(safeNextPath('https://evil.example', '/login')).toBe('/login');
  });
});

describe('login redirect helpers', () => {
  it('preserves the intended destination', () => {
    expect(buildLoginUrl('/scheduling')).toBe('/login?next=%2Fscheduling');
    expect(buildLoginUrl('/audit', '?page=2')).toBe('/login?next=%2Faudit%3Fpage%3D2');
  });

  it('omits a redundant next parameter', () => {
    expect(buildLoginUrl('/dashboard')).toBe('/login');
  });

  it('never returns an external post-login path', () => {
    expect(buildPostLoginPath('/scheduling')).toBe('/scheduling');
    expect(buildPostLoginPath('https://evil.example')).toBe('/dashboard');
    expect(buildPostLoginPath(null)).toBe('/dashboard');
    expect(buildPostLoginPath('/login')).toBe('/dashboard');
  });
});
