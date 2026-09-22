'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { normalizeApiError } from '@/lib/api/errors';
import { parseCurrentUser, type CurrentUser } from '@/lib/auth/types';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export type SignInResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export interface SessionContextValue {
  user: CurrentUser | null;
  status: SessionStatus;
  isAuthenticated: boolean;
  errorMessage: string | null;
  refreshSession: () => Promise<CurrentUser | null>;
  signIn: (credentials: {
    username: string;
    password: string;
  }) => Promise<SignInResult>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionState {
  status: SessionStatus;
  user: CurrentUser | null;
  errorMessage: string | null;
}

const INITIAL_STATE: SessionState = {
  status: 'loading',
  user: null,
  errorMessage: null,
};

const SESSION_UNVERIFIED_MESSAGE =
  'Your session could not be verified. The server may be temporarily unavailable.';

const NETWORK_ERROR_MESSAGE =
  'Your session could not be verified. Check your connection and try again.';

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function extractUser(payload: unknown): CurrentUser | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const parsed = parseCurrentUser((payload as { user?: unknown }).user);
  return parsed.ok ? parsed.user : null;
}

/**
 * Central auth/session state.
 *
 * The browser only ever talks to the same-origin BFF routes; tokens stay in
 * HttpOnly cookies and never enter React state.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(INITIAL_STATE);
  const initialised = useRef(false);

  const refreshSession = useCallback(async (): Promise<CurrentUser | null> => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });

      if (response.status === 200) {
        const user = extractUser(await readJson(response));
        if (user) {
          setState({ status: 'authenticated', user, errorMessage: null });
          return user;
        }
        setState({ status: 'unauthenticated', user: null, errorMessage: null });
        return null;
      }

      if (response.status === 401) {
        setState({ status: 'unauthenticated', user: null, errorMessage: null });
        return null;
      }

      setState({
        status: 'error',
        user: null,
        errorMessage: SESSION_UNVERIFIED_MESSAGE,
      });
      return null;
    } catch {
      setState({ status: 'error', user: null, errorMessage: NETWORK_ERROR_MESSAGE });
      return null;
    }
  }, []);

  const signIn = useCallback(
    async (credentials: {
      username: string;
      password: string;
    }): Promise<SignInResult> => {
      let response: Response;
      try {
        response = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(credentials),
        });
      } catch {
        return { ok: false, message: NETWORK_ERROR_MESSAGE };
      }

      if (response.ok) {
        const user = extractUser(await readJson(response));
        if (user) {
          setState({ status: 'authenticated', user, errorMessage: null });
          return { ok: true };
        }
        return { ok: false, message: SESSION_UNVERIFIED_MESSAGE };
      }

      const error = normalizeApiError(
        response.status,
        await readJson(response),
        response.headers.get('x-request-id'),
      );
      const result: SignInResult = { ok: false, message: error.detail };
      if (error.fieldErrors) {
        return { ...result, fieldErrors: error.fieldErrors };
      }
      return result;
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });
    } catch {
      // Even when the call fails the local session state must be dropped.
    }
    setState({ status: 'unauthenticated', user: null, errorMessage: null });
  }, []);

  useEffect(() => {
    if (initialised.current) {
      return;
    }
    initialised.current = true;
    void refreshSession();
  }, [refreshSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user: state.user,
      status: state.status,
      isAuthenticated: state.status === 'authenticated' && state.user !== null,
      errorMessage: state.errorMessage,
      refreshSession,
      signIn,
      logout,
    }),
    [state, refreshSession, signIn, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error('useSession must be used inside a SessionProvider.');
  }
  return context;
}
