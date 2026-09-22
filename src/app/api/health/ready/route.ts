import { ServerConfigurationError } from '@/lib/config/env';
import { checkBackendReadiness } from '@/lib/health/backend-readiness';
import { reportConfigurationFailure } from '@/lib/http/server-failure';
import { jsonResponse } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/health/ready`
 *
 * Readiness: this frontend, together with its backend dependency, can serve traffic. The
 * backend readiness endpoint is called server-to-server, so its host never appears in
 * the response.
 *
 * - dependency ready: `200` `{ "status": "ok" }`
 * - dependency unavailable, or the backend host is not usable in a production runtime:
 *   `503` `{ "status": "unavailable" }`
 *
 * The two failure causes are deliberately indistinguishable from outside, and the
 * configuration cause is recorded in the server log instead. The response is `no-store`:
 * a health verdict is a momentary observation and must never be cached as an artifact.
 *
 * A read, so no mutation guard applies.
 */
export async function GET(): Promise<Response> {
  const readiness = await checkBackendReadiness();

  if (readiness === 'ready') {
    return jsonResponse({ status: 'ok' });
  }

  if (readiness === 'misconfigured') {
    reportConfigurationFailure(
      'GET /api/health/ready',
      new ServerConfigurationError(
        'BACKEND_API_URL',
        'No usable backend host is configured in this runtime, so readiness cannot be checked.',
      ),
    );
  }

  return jsonResponse({ status: 'unavailable' }, { status: 503 });
}
