'use client';

import * as React from 'react';

/**
 * Root error boundary.
 *
 * `error.tsx` catches failures inside the application shell. This boundary catches the
 * ones that happen above it, including a failure in the root layout itself, which is why
 * it has to render its own `<html>` and `<body>`.
 *
 * Only a fixed operational message is shown: no stack trace, no exception message, no
 * digest contents, no environment value. The digest is a correlation reference the user
 * can quote to an administrator, and it carries no detail by itself. Recovery is
 * offered in place rather than forcing a sign-out, because a rendering failure is not an
 * authentication problem.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Operational record for the browser console: the correlation digest only.
    console.error('Unrecoverable application error', error.digest ?? '(no digest)');
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
          <div
            role="alert"
            className="w-full max-w-lg rounded-lg border border-line bg-surface p-8 text-center"
          >
            <p className="text-sm font-medium text-muted-foreground">Application error</p>
            <h1 className="mt-2 text-2xl font-semibold">The application could not start</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Something failed before the page could be displayed. Try again, and if the
              problem continues contact the system administrator.
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
      </body>
    </html>
  );
}
