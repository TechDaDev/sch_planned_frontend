import type { NextConfig } from 'next';

/**
 * Security headers for every response.
 *
 * The Content-Security-Policy is static rather than nonce-based. A nonce policy would
 * force every page into dynamic rendering, and Next.js injects inline bootstrap scripts
 * and inline styles by design, so the statically optimized App Router build needs
 * `'unsafe-inline'` for scripts and styles. `'unsafe-eval'` is only added in
 * development, where the framework's tooling requires it; production never receives it.
 *
 * `connect-src 'self'` stays sufficient because the browser only ever talks to this
 * same-origin BFF. The backend host, `127.0.0.1:8000`, analytics origins and wildcards
 * are deliberately absent.
 *
 * HSTS is not set here: it depends on deployment topology (HTTPS, domain, subdomains)
 * and is finalized when that is known.
 */

/** Directives shared by every environment. */
const BASE_CSP_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
];

function scriptDirective(isDevelopment: boolean): string {
  return isDevelopment
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
}

/**
 * Build the CSP header value.
 *
 * Exported so a test can assert the exact production policy, including the absence of
 * `'unsafe-eval'`.
 */
export function contentSecurityPolicy(isDevelopment: boolean): string {
  return [
    ...BASE_CSP_DIRECTIVES.slice(0, 4),
    scriptDirective(isDevelopment),
    "style-src 'self' 'unsafe-inline'",
    ...BASE_CSP_DIRECTIVES.slice(4),
  ].join('; ');
}

export function securityHeaders(isDevelopment: boolean) {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(isDevelopment) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=()',
    },
  ];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Client bundles stay free of source maps in production: nothing is gained by
  // shipping readable source to every visitor.
  productionBrowserSourceMaps: false,
  async headers() {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    return [
      {
        source: '/:path*',
        headers: securityHeaders(isDevelopment),
      },
    ];
  },
};

export default nextConfig;
