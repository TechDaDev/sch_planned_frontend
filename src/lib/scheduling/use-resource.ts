'use client';

/**
 * Single-record loading state for the scheduling workspace.
 *
 * The academic `useCollection` covers list endpoints; this covers the detail
 * endpoints (one schedule, one version). Both follow the same rule: loading is
 * derived by comparing a satisfied token against the current reload token instead
 * of being set from inside an effect body, so no cascading render is triggered.
 *
 * `loader` must be stable (wrap it in `useCallback`): changing it is what
 * triggers a reload.
 */

import { useCallback, useEffect, useState } from 'react';

import { ApiClientError, normalizeApiError, type ApiError } from '@/lib/api/errors';

export type ResourceStatus = 'loading' | 'success' | 'error';

export interface ResourceResult<T> {
  data: T | null;
  status: ResourceStatus;
  error: ApiError | null;
  /** True only until the first answer arrives. */
  isInitialLoad: boolean;
  reload: () => void;
}

function toApiError(value: unknown): ApiError {
  if (value instanceof ApiClientError) {
    return value.toApiError();
  }
  if (value instanceof DOMException && value.name === 'AbortError') {
    return { status: 0, code: 'aborted', detail: 'The request was cancelled.' };
  }
  return normalizeApiError(0, null);
}

interface LoadedResult<T> {
  token: number;
  data: T | null;
  error: ApiError | null;
}

export function useResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
): ResourceResult<T> {
  const [reloadToken, setReloadToken] = useState(0);
  const [loaded, setLoaded] = useState<LoadedResult<T>>({
    token: -1,
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    loader(controller.signal)
      .then((result) => {
        if (!active) {
          return;
        }
        setLoaded({ token: reloadToken, data: result, error: null });
      })
      .catch((cause: unknown) => {
        if (!active) {
          return;
        }
        const apiError = toApiError(cause);
        if (apiError.code === 'aborted') {
          return;
        }
        setLoaded({ token: reloadToken, data: null, error: apiError });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [loader, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const isPending = loaded.token !== reloadToken;

  return {
    data: isPending ? null : loaded.data,
    status: isPending ? 'loading' : loaded.error ? 'error' : 'success',
    error: isPending ? null : loaded.error,
    isInitialLoad: isPending && loaded.token === -1,
    reload,
  };
}
