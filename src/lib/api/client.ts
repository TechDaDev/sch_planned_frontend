/**
 * Browser-facing API client.
 *
 * All calls are same-origin requests to the BFF proxy `/api/backend/...`; the
 * browser never attaches an Authorization header and never sees a JWT. Cookies
 * are HttpOnly and therefore sent automatically by the browser.
 */

import {
  ApiClientError,
  normalizeApiError,
  type ApiError,
} from '@/lib/api/errors';

export const PROXY_BASE_PATH = '/api/backend';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Exact-match query parameters supported by the backend's filter mixin. */
export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export interface ApiFetchOptions {
  method?: HttpMethod;
  /** JSON request body (serialized with `content-type: application/json`). */
  json?: unknown;
  /** Raw body, e.g. FormData for multipart imports. */
  body?: BodyInit | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cache?: RequestCache;
  /** Backend-documented exact filters; empty values are omitted entirely. */
  query?: QueryParams;
}

export interface ApiDownload {
  blob: Blob;
  filename: string | null;
  contentType: string | null;
  status: number;
}

/**
 * Build the same-origin proxy path for an API-relative path.
 *
 * Auth token endpoints are never callable through the client: they are handled
 * by the dedicated auth route handlers only.
 */
export function toProxyPath(path: string): string {
  const segments = path
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    throw new ApiClientError({
      status: 400,
      code: 'invalid_request_path',
      detail: 'The API path is empty.',
    });
  }

  const normalized = segments.join('/').toLowerCase();
  if (
    normalized === 'auth/login' ||
    normalized === 'auth/refresh' ||
    normalized.startsWith('auth/login/') ||
    normalized.startsWith('auth/refresh/')
  ) {
    throw new ApiClientError({
      status: 403,
      code: 'endpoint_not_available',
      detail: 'This endpoint is not available through the API client.',
    });
  }

  return `${PROXY_BASE_PATH}/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;
}

/**
 * Build a query string from documented exact filters.
 *
 * `undefined`, `null` and empty values are omitted, so a filter control that is
 * left at its default never sends a parameter the backend did not document.
 */
export function buildQueryString(query?: QueryParams): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    const text = String(value);
    if (text.length === 0) {
      continue;
    }
    params.set(key, text);
  }
  const result = params.toString();
  return result.length > 0 ? `?${result}` : '';
}

function buildRequestInit(options: ApiFetchOptions): RequestInit {
  const headers: Record<string, string> = {
    accept: 'application/json, */*',
    ...options.headers,
  };

  let body: BodyInit | null | undefined = options.body;
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
    credentials: 'same-origin',
    cache: options.cache ?? 'no-store',
  };
  if (body !== undefined && body !== null) {
    init.body = body;
  }
  if (options.signal) {
    init.signal = options.signal;
  }
  return init;
}

async function readErrorPayload(response: Response): Promise<{
  error: ApiError;
}> {
  const contentType = response.headers.get('content-type') ?? '';
  let payload: unknown = null;
  if (contentType.includes('application/json')) {
    try {
      payload = (await response.json()) as unknown;
    } catch {
      payload = null;
    }
  } else {
    try {
      payload = await response.text();
    } catch {
      payload = null;
    }
  }
  return {
    error: normalizeApiError(
      response.status,
      payload,
      response.headers.get('x-request-id'),
    ),
  };
}

/** Perform a JSON API call. Throws `ApiClientError` on failure. */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const response = await fetch(
    `${toProxyPath(path)}${buildQueryString(options.query)}`,
    buildRequestInit(options),
  );
  if (!response.ok) {
    const { error } = await readErrorPayload(response);
    throw new ApiClientError(error);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return (await response.text()) as unknown as T;
  }
  return (await response.json()) as T;
}

/** Perform a call whose response is binary (XLSX/PDF) or otherwise streamed. */
export async function apiFetchBinary(
  path: string,
  options: ApiFetchOptions = {},
): Promise<ApiDownload> {
  const response = await fetch(
    `${toProxyPath(path)}${buildQueryString(options.query)}`,
    buildRequestInit(options),
  );
  if (!response.ok) {
    const { error } = await readErrorPayload(response);
    throw new ApiClientError(error);
  }
  return {
    blob: await response.blob(),
    filename: extractFilename(response.headers.get('content-disposition')),
    contentType: response.headers.get('content-type'),
    status: response.status,
  };
}

/** Extract a filename from a `Content-Disposition` header, when present. */
export function extractFilename(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return null;
    }
  }
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] ? match[1].trim() : null;
}

/** Trigger a browser download for a binary API response. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
