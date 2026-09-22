'use client';

/**
 * Reusable collection loading state.
 *
 * Every academic list uses this instead of its own fetch/loading/error logic, so
 * loading, failure, retry and post-mutation refresh behave identically across
 * the module.
 */

import { useCallback, useEffect, useState } from 'react';

import { ApiClientError, normalizeApiError, type ApiError } from '@/lib/api/errors';

export type CollectionStatus = 'loading' | 'success' | 'error';

export interface CollectionResult<T> {
  items: T[];
  status: CollectionStatus;
  error: ApiError | null;
  /** True only for the first load, so a refresh never blanks an intact list. */
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
  /** The reload token that produced this result; `-1` before the first load. */
  token: number;
  items: T[];
  error: ApiError | null;
}

/**
 * Load a collection with `loader`.
 *
 * `loader` must be stable (wrap it in `useCallback`): it is the only dependency
 * that triggers a load, so changing filter inputs never refetches unless the
 * caller decides to. The previous result is kept while a reload is in flight, so
 * a refresh never blanks an intact list.
 */
export function useCollection<T>(
  loader: (signal: AbortSignal) => Promise<T[]>,
): CollectionResult<T> {
  const [reloadToken, setReloadToken] = useState(0);
  const [loaded, setLoaded] = useState<LoadedResult<T>>({
    token: -1,
    items: [],
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
        setLoaded({ token: reloadToken, items: result, error: null });
      })
      .catch((cause: unknown) => {
        if (!active) {
          return;
        }
        const apiError = toApiError(cause);
        if (apiError.code === 'aborted') {
          return;
        }
        setLoaded({ token: reloadToken, items: [], error: apiError });
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
    items: loaded.items,
    status: isPending ? 'loading' : loaded.error ? 'error' : 'success',
    error: isPending ? null : loaded.error,
    isInitialLoad: isPending && loaded.token === -1,
    reload,
  };
}
