'use client';

import Link from 'next/link';

import { useAcademicUser } from '@/components/academic/use-academic-user';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RestrictedState } from '@/components/ui/states';
import { ownDepartmentId } from '@/lib/academic/permissions';
import {
  IMMUTABILITY_MESSAGE,
  READINESS_SCOPE_NOTE,
  SCHEDULING_ROUTES,
} from '@/lib/scheduling/constants';
import {
  canGenerateDepartmentPreview,
  canReadScheduleHistory,
  canRunValidation,
  isDepartmentlessScopedUser,
} from '@/lib/scheduling/permissions';
import { getRoleLabel } from '@/lib/roles';

interface ActionLink {
  href: string;
  label: string;
  description: string;
}

/**
 * Scheduling workspace landing page.
 *
 * Only role-appropriate actions are listed, and nothing is counted or averaged:
 * the page fetches no timetable data, so it shows no statistics.
 */
export function SchedulingLandingScreen() {
  const { user, capability } = useAcademicUser();

  if (isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="Scheduling operations are scoped to a department. Ask a college administrator to assign your department, then reload the page."
      />
    );
  }

  if (!canReadScheduleHistory(capability)) {
    return (
      <RestrictedState
        title="Not available for your role"
        description={`${
          user ? getRoleLabel(user.role) : 'This'
        } does not include the scheduling workspace. Instructors receive their timetable through their own view.`}
      />
    );
  }

  const operational = canRunValidation(capability);
  const actions: ActionLink[] = [];

  if (operational) {
    actions.push({
      href: SCHEDULING_ROUTES.readiness,
      label: 'Check Readiness',
      description: 'Validate the stored data for a semester and scope before generating.',
    });
  }

  if (canGenerateDepartmentPreview(capability, ownDepartmentId(capability))) {
    actions.push({
      href: SCHEDULING_ROUTES.generate,
      label: 'Generate Preview',
      description: 'Solve a preview timetable. Nothing is saved.',
    });
    actions.push({
      href: `${SCHEDULING_ROUTES.generate}#persist`,
      label: 'Generate & Save Draft',
      description: 'Run a new server-side generation and store it as the next draft version.',
    });
  }

  actions.push({
    href: SCHEDULING_ROUTES.schedules,
    label: 'Schedule History',
    description: 'Browse persisted schedules and their immutable version history.',
  });
  actions.push({
    href: SCHEDULING_ROUTES.compare,
    label: 'Compare Versions',
    description: 'Compare two versions of the same schedule side by side.',
  });

  return (
    <div className="space-y-6">
      <section aria-labelledby="scheduling-actions" className="space-y-3">
        <h2 id="scheduling-actions" className="text-base font-semibold">
          Available actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <Card key={action.href}>
              <CardHeader>
                <CardTitle>
                  <Link href={action.href} className="hover:underline">
                    {action.label}
                  </Link>
                </CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>What this workspace does</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-muted-foreground">
          <p>{READINESS_SCOPE_NOTE}</p>
          <p>{IMMUTABILITY_MESSAGE}</p>
          <p>
            Timetable views in this phase are read-only. Preview responses and stored versions
            are both rendered by the same viewer.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
