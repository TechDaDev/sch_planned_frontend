'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary.
 *
 * Only a safe operational message is displayed: internal stack traces, backend
 * payloads and environment values never reach the user. The digest is the
 * correlation value to quote in a support request.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side detail stays in the browser console for developers.
    console.error('Unhandled application error', error.digest ?? '(no digest)');
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div
        role="alert"
        className="w-full max-w-lg rounded-lg border border-line bg-surface p-8 text-center"
      >
        <p className="text-sm font-medium text-muted-foreground">Error</p>
        <h1 className="mt-2 text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page could not be displayed. Try again, and if the problem continues contact
          the system administrator.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
