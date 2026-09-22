import { requestBackendRefresh } from '@/lib/auth/backend';
import {
  appendAuthCookies,
  appendClearAuthCookies,
  readAccessToken,
  readRefreshToken,
} from '@/lib/auth/cookies';
import { buildBackendUrl } from '@/lib/auth/proxy-path';
import { BACKEND_API_PREFIX, getBackendApiUrl } from '@/lib/config/env';
import { errorResponse } from '@/lib/http/responses';
import { sameOriginRejectionResponse } from '@/lib/http/same-origin';
import { withServerFailureHandling } from '@/lib/http/server-failure';

export const dynamic = 'force-dynamic';

/**
 * Header allowlists.
 *
 * Browser headers are never passed through blindly: `Authorization` and `Cookie`
 * are controlled exclusively by this server, and hop-by-hop or security headers
 * (`Host`, `X-Forwarded-*`, `Connection`, ...) are never forwarded.
 */
const FORWARDED_REQUEST_HEADERS = [
  'content-type',
  'accept',
  'accept-language',
  'if-none-match',
] as const;

/** Response headers preserved so future XLSX/PDF downloads keep working. */
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-disposition',
  'content-language',
  'content-length',
  'etag',
  'last-modified',
  'vary',
] as const;

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

type ForwardResult =
  | { ok: true; response: Response }
  | { ok: false; reason: 'unavailable' };

async function forwardToBackend(
  request: Request,
  url: URL,
  accessToken: string | null,
  body: ArrayBuffer | null,
): Promise<ForwardResult> {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  };
  if (!BODYLESS_METHODS.has(request.method) && body && body.byteLength > 0) {
    init.body = body;
  }

  try {
    return { ok: true, response: await fetch(url, init) };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

function buildProxyResponse(
  backendResponse: Response,
  extraHeaders: Headers,
): Response {
  const headers = new Headers(extraHeaders);
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = backendResponse.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'no-store');
  }

  const bodyless =
    backendResponse.status === 204 ||
    backendResponse.status === 205 ||
    backendResponse.status === 304;
  return new Response(bodyless ? null : backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers,
  });
}

/**
 * `ALL /api/backend/[...path]`
 *
 * Authenticated same-origin proxy to the Django REST API. The Next.js server
 * owns the Authorization header: the browser sends HttpOnly cookies only.
 *
 * Token endpoints (`auth/login`, `auth/refresh`) are blocked here so they can
 * only be reached through the dedicated auth route handlers.
 *
 * State-changing methods additionally pass the same-origin guard, so a request
 * triggered by another site is rejected here and never forwarded to Django.
 * `GET` and `HEAD` are unaffected.
 */
async function handleProxyRequest(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const crossSite = sameOriginRejectionResponse(request);
  if (crossSite) {
    return crossSite;
  }

  return withServerFailureHandling(`/api/backend ${request.method}`, () =>
    forwardRequest(request, context),
  );
}

async function forwardRequest(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const params = await context.params;
  const target = buildBackendUrl(
    getBackendApiUrl(),
    BACKEND_API_PREFIX,
    params.path ?? [],
  );

  if (!target.ok) {
    if (target.reason === 'blocked_endpoint') {
      return errorResponse(
        403,
        'endpoint_not_proxied',
        'Authentication token endpoints are not available through this proxy.',
      );
    }
    return errorResponse(400, 'invalid_path', 'The requested API path is not valid.');
  }

  const url = target.url;
  url.search = new URL(request.url).search;

  const accessToken = readAccessToken(request);
  const refreshToken = readRefreshToken(request);

  let body: ArrayBuffer | null = null;
  if (!BODYLESS_METHODS.has(request.method)) {
    try {
      body = await request.arrayBuffer();
    } catch {
      return errorResponse(400, 'invalid_request', 'The request body could not be read.');
    }
  }

  const firstAttempt = await forwardToBackend(request, url, accessToken, body);
  if (!firstAttempt.ok) {
    return errorResponse(
      503,
      'backend_unavailable',
      'The server is temporarily unavailable. Please try again.',
    );
  }

  let backendResponse = firstAttempt.response;
  const extraHeaders = new Headers();

  if (backendResponse.status === 401) {
    if (!refreshToken) {
      return errorResponse(
        401,
        'unauthenticated',
        'You are not signed in.',
      );
    }

    const refreshed = await requestBackendRefresh(refreshToken);
    if (!refreshed.ok) {
      if (refreshed.reason === 'invalid_refresh') {
        appendClearAuthCookies(extraHeaders);
        return errorResponse(
          401,
          'session_expired',
          'Your session has expired. Please sign in again.',
          extraHeaders,
        );
      }
      return errorResponse(
        503,
        'backend_unavailable',
        'The server is temporarily unavailable. Please try again.',
      );
    }

    appendAuthCookies(extraHeaders, { access: refreshed.access });
    const retry = await forwardToBackend(request, url, refreshed.access, body);
    if (!retry.ok) {
      return errorResponse(
        503,
        'backend_unavailable',
        'The server is temporarily unavailable. Please try again.',
      );
    }

    if (retry.response.status === 401) {
      // Exactly one refresh retry: a second 401 is terminal for this request.
      return errorResponse(
        401,
        'session_expired',
        'Your session has expired. Please sign in again.',
      );
    }
    backendResponse = retry.response;
  }

  return buildProxyResponse(backendResponse, extraHeaders);
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return handleProxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return handleProxyRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  return handleProxyRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return handleProxyRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return handleProxyRequest(request, context);
}

export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  return handleProxyRequest(request, context);
}
