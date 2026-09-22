'use client';

import Link from 'next/link';

import { useSession } from '@/components/providers/session-provider';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import type { CurrentUser } from '@/lib/auth/types';
import {
  getNavigationForRole,
  needsDepartmentAssignment,
} from '@/lib/navigation/navigation';
import { getRoleLabel } from '@/lib/roles';

function IdentityCard({ user }: { user: CurrentUser }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signed in as</CardTitle>
        <CardDescription>Identity returned by the backend for this session.</CardDescription>
      </CardHeader>
      <CardBody>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Name</dt>
            <dd className="text-sm">{user.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Username
            </dt>
            <dd className="text-sm">{user.username}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Role</dt>
            <dd className="text-sm">
              <Badge tone="info">{getRoleLabel(user.role)}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Department
            </dt>
            <dd className="text-sm">
              {user.department
                ? `${user.department.name} (${user.department.code})`
                : 'No department assigned'}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Session verified against the backend API. Role-based permissions are enforced by the
          backend on every request.
        </p>
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useSession();

  if (!user) {
    // The shell only renders this page for an authenticated user.
    return null;
  }

  const modules = getNavigationForRole(user.role).filter(
    (item) => item.href !== '/dashboard',
  );
  const missingDepartment = needsDepartmentAssignment(user.role, user.department);

  return (
    <div className="space-y-6">
      <PageHeading
        title={`Welcome, ${user.full_name}`}
        description="Your signed-in account, its role, and the modules that role may use."
      />

      {missingDepartment ? (
        <Alert tone="warning" title="No department is assigned to this account.">
          Department-scoped modules stay restricted until a college administrator assigns your
          department.
        </Alert>
      ) : null}

      <IdentityCard user={user} />

      <section aria-labelledby="available-modules" className="space-y-3">
        <h2 id="available-modules" className="text-base font-semibold">
          Available modules for your role
        </h2>
        {modules.length === 0 ? (
          <Alert tone="info">
            No additional modules are available for this account role.
          </Alert>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map((item) => (
              <Card key={item.href}>
                <CardHeader>
                  <CardTitle>
                    <Link href={item.href} className="hover:underline">
                      {item.label}
                    </Link>
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardBody>
                  <Link className="text-sm underline" href={item.href}>
                    Open {item.label}
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
