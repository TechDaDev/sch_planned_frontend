import { describe, expect, it } from 'vitest';

import { PROTECTED_PREFIXES, isProtectedPath } from '@/lib/navigation/protected-paths';
import { config } from '@/proxy';

/**
 * The protected surface is shared by the proxy and the UI capability layer, so it is
 * asserted once here.
 */
describe('protected path prefixes', () => {
  it('covers every product module', () => {
    for (const prefix of [
      '/dashboard',
      '/academic',
      '/resources',
      '/scheduling',
      '/published',
      '/reports',
      '/audit',
      '/imports',
      '/my-timetable',
      '/forbidden',
    ]) {
      expect(PROTECTED_PREFIXES).toContain(prefix);
    }
  });

  it('matches the prefix itself and any child path', () => {
    expect(isProtectedPath('/audit')).toBe(true);
    expect(isProtectedPath('/audit')).toBe(true);
    expect(isProtectedPath('/audit/9f0f6e3e-7a4d')).toBe(true);
    expect(isProtectedPath('/imports/semester-plan')).toBe(true);
    expect(isProtectedPath('/scheduling/versions/501/workflow')).toBe(true);
  });

  it('does not match a path that merely starts with the same characters', () => {
    expect(isProtectedPath('/audit-trail')).toBe(false);
    expect(isProtectedPath('/reportsx')).toBe(false);
    expect(isProtectedPath('/dashboard-preview')).toBe(false);
  });

  it('leaves the public surface unprotected', () => {
    expect(isProtectedPath('/login')).toBe(false);
    expect(isProtectedPath('/')).toBe(false);
  });

  it('registers every prefix with the proxy matcher', () => {
    for (const prefix of PROTECTED_PREFIXES) {
      expect(config.matcher).toContain(`${prefix}/:path*`);
    }
    expect(config.matcher).toContain('/');
    expect(config.matcher).toContain('/login');
  });
});
