import { Spinner } from '@/components/ui/spinner';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner />
        <span>Loading…</span>
      </div>
    </div>
  );
}
