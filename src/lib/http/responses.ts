/**
 * Small helpers for building JSON route-handler responses.
 *
 * Auth and proxy responses are `no-store` by construction: nothing about a
 * session may be cached by a browser or an intermediary.
 */

export const NO_STORE_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'no-store, no-cache, must-revalidate',
};

export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Headers } = {},
): Response {
  const headers = init.headers ?? new Headers();
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

export function errorResponse(
  status: number,
  code: string,
  detail: string,
  headers?: Headers,
): Response {
  return jsonResponse({ code, detail }, { status, headers });
}

/** Largest accepted auth request body (defensive bound). */
export const MAX_AUTH_BODY_BYTES = 8 * 1024;

export async function readJsonRequest(
  request: Request,
  maxBytes: number = MAX_AUTH_BODY_BYTES,
): Promise<unknown> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return null;
  }
  if (text.length === 0 || text.length > maxBytes) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readNonEmptyString(
  source: Record<string, unknown>,
  key: string,
): string | null {
  const value = source[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
