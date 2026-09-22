'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AppShell } from '@/components/app-shell/app-shell';
import { useSession } from '@/components/providers/session-provider';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/ui/spinner';
import { RestrictedState } from '@/components/ui/states';
import { getRoleLabel } from '@/lib/roles';
import {
  canAccessPath,
  isDepartmentScopedPath,
  needsDepartmentAssignment,
} from '@/lib/navigation/navigation';
import { buildLoginUrl } from '@/lib/navigation/redirect';

/**
 * Gate for every authenticated route.
 *
 * Nothing inside the shell renders until the session is known, so an
 * unauthenticated visitor never sees a flash of protected content.
 */
export function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const { status, user, errorMessage, refreshSession } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace(buildLoginUrl(pathname));
    }
  }, [status, pathname, router]);

  if (status === 'loading') {
    return <LoadingScreen message="Restoring your session…" />;
  }

  if (status === 'error' || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md">
          <RestrictedState
            title="Session unavailable"
            description={errorMessage ?? 'Your session could not be verified.'}
            detail={
              <Button variant="secondary" size="sm" onClick={() => void refreshSession()}>
                Try again
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (!canAccessPath(user.role, pathname)) {
    return (
      <AppShell user={user}>
        <RestrictedState
          title="Not available for your role"
          description={`The ${getRoleLabel(user.role)} role does not include this module. Contact a college administrator if you need access.`}
        />
      </AppShell>
    );
  }

  if (
    needsDepartmentAssignment(user.role, user.department) &&
    isDepartmentScopedPath(pathname)
  ) {
    return (
      <AppShell user={user}>
        <RestrictedState
          title="No department is assigned to this account."
          description="This module works with department-scoped data. Ask a college administrator to assign your department, then reload the page."
        />
      </AppShell>
    );
  }

  return <AppShell user={user}>{children}</AppShell>;
}
