'use client';

import * as React from 'react';

import { useAcademicUser } from '@/components/academic/use-academic-user';
import { VersionComparison } from '@/components/scheduling/version-comparison';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';
import { useCollection } from '@/lib/academic/use-collection';
import { schedulesApi } from '@/lib/scheduling/api';
import { IMMUTABILITY_MESSAGE } from '@/lib/scheduling/constants';
import { formatScope, formatSemester } from '@/lib/scheduling/formatters';
import { canCompareVersions } from '@/lib/scheduling/permissions';
import type { ScheduleSummary, ScheduleVersionSummary } from '@/lib/scheduling/types';

/**
 * Version comparison workspace.
 *
 * One logical schedule is chosen first, then two of *its* versions. Comparing a
 * department's timetable against another department's is not offered, because the
 * two describe unrelated sessions.
 */
export function CompareScreen() {
  const { capability } = useAcademicUser();

  const [scheduleId, setScheduleId] = React.useState<number | null>(null);

  const loadSchedules = React.useCallback(
    (signal: AbortSignal) => schedulesApi.list({}, signal),
    [],
  );
  const loadVersions = React.useCallback(
    (signal: AbortSignal) =>
      scheduleId === null
        ? Promise.resolve<ScheduleVersionSummary[]>([])
        : schedulesApi.versions(scheduleId, signal),
    [scheduleId],
  );

  const scheduleCollection = useCollection<ScheduleSummary>(loadSchedules);
  const versionCollection = useCollection<ScheduleVersionSummary>(loadVersions);

  const schedules = scheduleCollection.items;
  const versions = versionCollection.items;
  const error =
    scheduleCollection.error?.detail ?? versionCollection.error?.detail ?? null;

  if (!canCompareVersions(capability)) {
    return (
      <RestrictedState
        title="Version comparison is not available for your role"
        description="Comparing stored versions requires access to the schedule history of a department."
      />
    );
  }

  const selected = schedules.find((schedule) => schedule.id === scheduleId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Compare Versions"
        description="Compare two versions of the same schedule. Sessions are paired by their scheduling session id."
      />

      <Alert tone="info" title="Read-only comparison">
        {IMMUTABILITY_MESSAGE}
      </Alert>

      {error ? (
        <Alert tone="danger" title="Data could not be loaded">
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Select a schedule</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {scheduleCollection.isInitialLoad ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading schedules…
            </p>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No persisted schedule is visible for your account yet, so there is nothing to compare.
            </p>
          ) : (
            <div className="text-sm">
              <label
                htmlFor="compare-schedule"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Schedule
              </label>
              <select
                id="compare-schedule"
                className="mt-1 h-10 w-full max-w-xl rounded-md border border-line bg-surface px-2 text-sm"
                value={scheduleId === null ? '' : String(scheduleId)}
                onChange={(event) =>
                  setScheduleId(event.target.value === '' ? null : Number(event.target.value))
                }
              >
                <option value="">Select a schedule</option>
                {schedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    #{schedule.id} · {formatScope(schedule.scope)} ·{' '}
                    {schedule.scope === 'COLLEGE'
                      ? 'College-wide'
                      : (schedule.department?.code ?? 'department')}{' '}
                    · {formatSemester(schedule.semester)} · {schedule.version_count} version
                    {schedule.version_count === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selected ? (
            <p className="text-xs text-muted-foreground">
              Comparing versions of schedule #{selected.id}. Both selectors below are filled from
              this schedule&apos;s history only.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {scheduleId !== null ? (
        <Card>
          <CardHeader>
            <CardTitle>Comparison</CardTitle>
          </CardHeader>
          <CardBody>
            {versionCollection.isInitialLoad ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Loading version history…
              </p>
            ) : (
              <VersionComparison scheduleId={scheduleId} versions={versions} />
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
