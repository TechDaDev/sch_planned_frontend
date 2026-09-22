import { vi } from 'vitest';

export interface FetchCall {
  url: string;
  method: string;
  init: RequestInit;
}

export interface MockRoute {
  /** Exact absolute URL the route answers. */
  url: string;
  method?: string;
  handler: (init: RequestInit) => Response | Promise<Response>;
}

export interface FetchMock {
  calls: FetchCall[];
  callsTo: (url: string) => FetchCall[];
  countTo: (url: string) => number;
}

/**
 * Install a strict fetch mock for the Django backend.
 *
 * Any request that does not match a declared route fails loudly, which keeps
 * "no unexpected backend call" a testable property.
 */
export function installFetchMock(routes: MockRoute[]): FetchMock {
  const calls: FetchCall[] = [];

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ url, method, init: init ?? {} });

      const route = routes.find(
        (candidate) =>
          candidate.url === url && (candidate.method ?? 'GET').toUpperCase() === method,
      );
      if (!route) {
        throw new Error(`Unexpected backend call: ${method} ${url}`);
      }
      return route.handler(init ?? {});
    },
  );

  vi.stubGlobal('fetch', fetchMock);

  return {
    calls,
    callsTo: (url) => calls.filter((call) => call.url === url),
    countTo: (url) => calls.filter((call) => call.url === url).length,
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function textResponse(body: string, status: number, contentType = 'text/plain'): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': contentType },
  });
}

export function binaryResponse(
  bytes: Uint8Array,
  contentType: string,
  headers: Record<string, string> = {},
): Response {
  // Copy into a plain ArrayBuffer so the bytes satisfy `BodyInit`.
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Response(body, {
    status: 200,
    headers: { 'content-type': contentType, ...headers },
  });
}

export function tokenPairResponse(access = 'access-token-1', refresh = 'refresh-token-1'): Response {
  return jsonResponse({ access, refresh });
}

export function currentUserPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    username: 'r.salim',
    email: 'r.salim@example.edu',
    first_name: 'Rana',
    last_name: 'Salim',
    full_name: 'Rana Salim',
    role: 'SCHEDULER',
    department: { id: 3, name: 'Computer Science', code: 'CS' },
    ...overrides,
  };
}
