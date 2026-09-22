import type { NextConfig } from 'next';

/**
 * Security headers that are safe for every response.
 *
 * A Content-Security-Policy is deliberately not defined here: Next.js injects
 * inline bootstrap scripts and a strict policy needs nonce plumbing plus build
 * and runtime testing. CSP is scheduled for the frontend deployment phase (F5).
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
