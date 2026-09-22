import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg rounded-lg border border-line bg-surface p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you requested does not exist or has been moved. Use the dashboard to
          continue.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Go to dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
