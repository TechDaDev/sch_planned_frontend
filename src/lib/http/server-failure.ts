import 'server-only';

import { ServerConfigurationError } from '@/lib/config/env';
import { errorResponse } from '@/lib/http/responses';

/**
 * Server-side failure handling for route handlers.
 *
 * A misconfigured production process, or an unexpected exception, must answer the
 * browser with a controlled failure. Nothing derived from the exception reaches the
 * client: no message, no stack, no digest, no environment value and no internal
 * backend URL. The diagnostic stays in the server log, where it is useful and where
 * it cannot be read by a client.
 *
 * Nothing logged here may contain a token, a cookie, an Authorization header, a
 * password or a request body. Only the failing variable name and the operator-facing
 * message written in `env.ts` are recorded.
 */

function logServerFailure(label: string, error: unknown): void {
  if (error instanceof ServerConfigurationError) {
    // The message names the variable and never contains its value.
    console.error(`[configuration] ${label}: ${error.variable} — ${error.message}`);
    return;
  }
  console.error(`[server] ${label}: an unexpected server error occurred`);
}

/** Controlled response for a production configuration problem. */
export function configurationFailureResponse(label: string, error: unknown): Response {
  logServerFailure(label, error);
  return errorResponse(
    503,
    'server_misconfigured',
    'The server is not configured to reach its dependencies. Please contact the administrator.',
  );
}

/**
 * Wrap a route handler so no unexpected exception becomes an uncontrolled 500.
 *
 * A configuration problem is reported as such; anything else becomes a generic
 * server failure. Both bodies are fixed strings.
 */
export async function withServerFailureHandling(
  label: string,
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ServerConfigurationError) {
      return configurationFailureResponse(label, error);
    }
    logServerFailure(label, error);
    return errorResponse(
      500,
      'internal_error',
      'The server could not complete the request. Please try again.',
    );
  }
}

/** Log a configuration problem without building a response. */
export function reportConfigurationFailure(label: string, error: unknown): void {
  logServerFailure(label, error);
}
