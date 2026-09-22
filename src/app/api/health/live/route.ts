import { jsonResponse } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/health/live`
 *
 * Liveness: the process is up and serving. It deliberately checks nothing else, so it
 * stays useful when a dependency is down. The body is a fixed, public value and names
 * no path, environment value, backend host or version.
 */
export function GET(): Response {
  return jsonResponse({ status: 'ok' });
}
