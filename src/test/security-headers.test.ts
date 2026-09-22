import { describe, expect, it } from 'vitest';

import nextConfig, { contentSecurityPolicy, securityHeaders } from '../../next.config';

/**
 * Security header policy.
 *
 * The policy is asserted as a whole, because the important properties are what it
 * contains and, more importantly, what it must never contain.
 */
describe('content security policy', () => {
  const production = contentSecurityPolicy(false);
  const development = contentSecurityPolicy(true);

  it('is a single header value, not a set of fragments', () => {
    expect(production.split('; ').length).toBeGreaterThan(8);
    expect(production).not.toContain('\n');
  });

  it('keeps the documented production directives', () => {
    expect(production).toContain("default-src 'self'");
    expect(production).toContain("base-uri 'self'");
    expect(production).toContain("form-action 'self'");
    expect(production).toContain("frame-ancestors 'none'");
    expect(production).toContain("object-src 'none'");
    expect(production).toContain("script-src 'self' 'unsafe-inline'");
    expect(production).toContain("style-src 'self' 'unsafe-inline'");
    expect(production).toContain("img-src 'self' data: blob:");
    expect(production).toContain("font-src 'self' data:");
    expect(production).toContain("connect-src 'self'");
    expect(production).toContain("media-src 'self'");
    expect(production).toContain("worker-src 'self' blob:");
    expect(production).toContain("manifest-src 'self'");
  });

  it('never allows eval in production', () => {
    expect(production).not.toContain('unsafe-eval');
  });

  it('allows eval only in development, where the framework tooling needs it', () => {
    expect(development).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it('never whitelists the backend, a third party or a wildcard', () => {
    expect(production).not.toContain('127.0.0.1');
    expect(production).not.toContain('8000');
    expect(production).not.toContain('*');
    expect(production).not.toContain('http://');
    expect(production).not.toContain('https://');
    expect(production).not.toContain('railway');
  });

  it('keeps connect-src same-origin, because all traffic uses the BFF', () => {
    expect(production).toContain("connect-src 'self';");
  });

  it('does not forbid framing twice: X-Frame-Options and frame-ancestors agree', () => {
    expect(production).toContain("frame-ancestors 'none'");
    expect(securityHeaders(false)).toContainEqual({
      key: 'X-Frame-Options',
      value: 'DENY',
    });
  });
});

describe('security headers', () => {
  it('preserves every pre-existing header', () => {
    for (const isDevelopment of [false, true]) {
      const headers = securityHeaders(isDevelopment);

      expect(headers).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' });
      expect(headers).toContainEqual({
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      });
      expect(headers).toContainEqual({ key: 'X-Frame-Options', value: 'DENY' });
      expect(headers).toContainEqual({
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=()',
      });
    }
  });

  it('adds the policy without removing anything else', () => {
    const keys = securityHeaders(false).map((header) => header.key);

    expect(keys).toContain('Content-Security-Policy');
    expect(keys).toEqual([
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'X-Frame-Options',
      'Permissions-Policy',
    ]);
  });

  it('does not set HSTS, which depends on deployment topology', () => {
    const keys = securityHeaders(false).map((header) => header.key);

    expect(keys).not.toContain('Strict-Transport-Security');
  });

  it('applies the headers to every path', async () => {
    const rules = await nextConfig.headers!();

    expect(rules).toHaveLength(1);
    expect(rules[0]!.source).toBe('/:path*');
  });
});

describe('build hardening settings', () => {
  it('keeps the framework signature out of responses', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it('does not publish production source maps', () => {
    expect(nextConfig.productionBrowserSourceMaps).toBe(false);
  });
});
