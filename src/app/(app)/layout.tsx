import { AuthenticatedShell } from '@/components/auth/authenticated-shell';
import { SessionProvider } from '@/components/providers/session-provider';
import { ToastProvider } from '@/components/providers/toast-provider';

/**
 * Layout for every authenticated destination.
 *
 * The session is resolved once, here, instead of in each page, and the shell is
 * only rendered when a verified user exists. The toast provider supplies the
 * shared feedback channel for mutations.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <ToastProvider>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </ToastProvider>
    </SessionProvider>
  );
}
