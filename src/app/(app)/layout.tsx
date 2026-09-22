import { AuthenticatedShell } from '@/components/auth/authenticated-shell';
import { SessionProvider } from '@/components/providers/session-provider';

/**
 * Layout for every authenticated destination.
 *
 * The session is resolved once, here, instead of in each page, and the shell is
 * only rendered when a verified user exists.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionProvider>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </SessionProvider>
  );
}
