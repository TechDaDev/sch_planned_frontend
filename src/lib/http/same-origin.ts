/**
 * Same-origin guard for state-changing browser requests.
 *
 * The application authenticates with HttpOnly cookies, so a browser automatically
 * attaches them to any request it makes, including one triggered by another site.
 * `SameSite=Lax` already blocks cross-site cookie delivery for these methods, and the
 * BFF is same-origin; this guard is the third layer, and it is the only one that can
 * reject a request before it reaches Django.
 *
 * It is deliberately small and header-based, and it never treats a browser-supplied
 * header as a credential:
 *
 * - `Sec-Fetch-Site: cross-site` is rejected. The header is set by the browser and
 *   cannot be forged by page script, which is what makes it useful here.
 * - When `Origin` is present it must match the origin the request was actually
 *   delivered to. `X-Forwarded-Host` and `X-Forwarded-Proto` are never consulted for
 *   this decision, because any client can set them.
 * - A request with neither header stays allowed: a non-browser client such as a
 *   health check, a script or a server-side test does not send them, and it also
 *   cannot be tricked into attaching a user's cookies.
 *
 * Only state-changing methods are checked. `GET` and `HEAD` are never blocked, because
 * they must remain ordinary reads.
 */

import { errorResponse } from '@/lib/http/responses';

/** Methods that can change server state and therefore carry CSRF risk. */
export const MUTATION_METHODS: readonly string[] = ['POST', 'PUT', 'PATCH', 'DELETE'];
export type SameOriginDecision =
  | { allowed: true }
  | { allowed: false; reason: 'cross_site' | 'origin_mismatch' };

/** True when the guard applies to this method. */
export function isMutationMethod(method: string): boolean {
  return MUTATION_METHODS.includes(method.toUpperCase());
}

/**
 * The hosts a same-origin request may legitimately claim.
 *
 * Two sources are consulted, both derived from the request as delivered: the URL the
 * framework built and the `Host` header the client addressed. The scheme is not compared,
 * because TLS termination in front of the application changes the scheme the server sees
 * while leaving the request same-origin from the browser's point of view.
 *
 * `X-Forwarded-Host` and `X-Forwarded-Proto` are deliberately never consulted: any client
 * can set them, so they are not evidence of anything.
 */
function allowedHosts(request: Request): Set<string> {
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(request.url).host.toLowerCase());
  } catch {
    // A request without a usable URL contributes no host.
  }
  const hostHeader = request.headers.get('host');
  if (hostHeader !== null && hostHeader.trim().length > 0) {
    hosts.add(hostHeader.trim().toLowerCase());
  }
  return hosts;
}

/**
 * Decide whether a state-changing request may proceed.
 *
 * The caller decides how to answer; this function only judges.
 */
export function checkSameOriginMutation(request: Request): SameOriginDecision {
  if (!isMutationMethod(request.method)) {
    return { allowed: true };
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite !== null && fetchSite.trim().toLowerCase() === 'cross-site') {
    return { allowed: false, reason: 'cross_site' };
  }

  const origin = request.headers.get('origin');
  if (origin !== null && origin.trim().length > 0) {
    let supplied: URL;
    try {
      supplied = new URL(origin.trim());
    } catch {
      return { allowed: false, reason: 'origin_mismatch' };
    }
    if (supplied.protocol !== 'http:' && supplied.protocol !== 'https:') {
      return { allowed: false, reason: 'origin_mismatch' };
    }
    const hosts = allowedHosts(request);
    if (hosts.size === 0 || !hosts.has(supplied.host.toLowerCase())) {
      return { allowed: false, reason: 'origin_mismatch' };
    }
  }

  return { allowed: true };
}

/** Body of a rejected cross-site request. Never echoes the supplied origin. */
export const CROSS_SITE_REJECTION = {
  status: 403,
  code: 'cross_site_request_rejected',
  detail: 'The request was rejected because it did not originate from this application.',
} as const;

/**
 * Reject a cross-site mutation, or return `null` when the request may proceed.
 *
 * Nothing about the request is logged: a rejected cross-site attempt must not put a
 * cookie, a token or a header value into the server log.
 */
export function sameOriginRejectionResponse(request: Request): Response | null {
  const decision = checkSameOriginMutation(request);
  if (decision.allowed) {
    return null;
  }
  return errorResponse(
    CROSS_SITE_REJECTION.status,
    CROSS_SITE_REJECTION.code,
    CROSS_SITE_REJECTION.detail,
  );
}
