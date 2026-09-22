/**
 * Generic CRUD helpers for the same-origin BFF.
 *
 * Domain layers (academic, resources) build their typed API objects on top of
 * these. The transport itself lives in `client.ts`, so no domain layer knows
 * about the backend host, cookies or tokens.
 *
 * The accepted backend exposes no hard delete, so no delete helper exists here.
 */

import { apiFetch, type QueryParams } from '@/lib/api/client';
import { ApiClientError } from '@/lib/api/errors';

/** Join an endpoint and an optional primary key into a proxy-relative path. */
export function collectionPath(endpoint: string, id?: number): string {
  return id === undefined ? endpoint : `${endpoint}/${id}`;
}

export function unexpectedPayloadError(endpoint: string): ApiClientError {
  return new ApiClientError({
    status: 500,
    code: 'unexpected_response',
    detail: `The server returned an unexpected payload for "${endpoint}".`,
  });
}

export interface ListOptions {
  signal?: AbortSignal;
  /** Backend-documented exact filters (`?instructor=3&semester=1`). */
  query?: QueryParams;
}

/**
 * Fetch a collection.
 *
 * List endpoints are unpaginated arrays; a non-array payload is treated as an
 * unexpected response instead of being silently coerced.
 */
export async function listCollection<T>(
  endpoint: string,
  options: ListOptions = {},
): Promise<T[]> {
  const payload = await apiFetch<unknown>(collectionPath(endpoint), {
    signal: options.signal,
    query: options.query,
  });
  if (!Array.isArray(payload)) {
    throw unexpectedPayloadError(endpoint);
  }
  return payload as T[];
}

export async function getRecord<T>(
  endpoint: string,
  id: number,
  signal?: AbortSignal,
): Promise<T> {
  const payload = await apiFetch<unknown>(collectionPath(endpoint, id), { signal });
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw unexpectedPayloadError(endpoint);
  }
  return payload as T;
}

export async function createRecord<TRead>(
  endpoint: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<TRead> {
  return apiFetch<TRead>(collectionPath(endpoint), {
    method: 'POST',
    json: payload,
    signal,
  });
}

/**
 * Update an existing record.
 *
 * `PATCH` is used for both full-form edits and status changes: write serializers
 * declare required foreign keys, and partial updates keep a small edit from
 * demanding fields the user did not touch.
 */
export async function patchRecord<TRead>(
  endpoint: string,
  id: number,
  payload: unknown,
  signal?: AbortSignal,
): Promise<TRead> {
  return apiFetch<TRead>(collectionPath(endpoint, id), {
    method: 'PATCH',
    json: payload,
    signal,
  });
}
