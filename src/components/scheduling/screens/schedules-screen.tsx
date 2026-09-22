'use client';

import Link from 'next/link';
import * as React from 'react';

import { DataTable, type ColumnSpec } from '@/components/academic/data-table';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { DepartmentSelect, SemesterSelect } from '@/components/scheduling/scope-controls';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';
import { departmentsApi, semestersApi } from '@/lib/academic/api';
import type { Department, Semester } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import {
  DEPARTMENT_SCOPED_PLACEHOLDER,
  IMMUTABILITY_MESSAGE,
  SCHEDULE_SCOPE_OPTIONS,
  SCHEDULING_ROUTES,
} from '@/lib/scheduling/constants';
import {
  formatScheduleStatus,
  formatScope,
  formatSemester,
  scheduleStatusTone,
} from '@/lib/scheduling/formatters';
import { schedulesApi } from '@/lib/scheduling/api';
import {
  canChooseAnyDepartment,
  canReadScheduleHistory,
  isDepartmentlessScopedUser,
} from '@/lib/scheduling/permissions';
import type { ScheduleScope, ScheduleSummary } from '@/lib/scheduling/types';

/** `2026-10-01 09:30` from an ISO timestamp, without locale drift. */
function formatTimestamp(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return value;
  }
  return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
}

/** Persisted schedule collection: filters, identity and version counts. */
export function SchedulesScreen() {
  const { user, capability } = useAcademicUser();

  const [semesterId, setSemesterId] = React.useState<number | null>(null);
  const [scope, setScope] = React.useState<ScheduleScope | null>(null);
  const [departmentId, setDepartmentId] = React.useState<number | null>(null);

  const loadSemesters = React.useCallback((signal: AbortSignal) => semestersApi.list(signal), []);
  const loadDepartments = React.useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );
  const semesters = useCollection<Semester>(loadSemesters);
  const departments = useCollection<Department>(loadDepartments);

  const filters = React.useMemo(
    () => ({
      ...(semesterId === null ? {} : { semester: semesterId }),
      ...(scope === null ? {} : { scope }),
      ...(departmentId === null ? {} : { department: departmentId }),
    }),
    [semesterId, scope, departmentId],
  );

  const loadSchedules = React.useCallback(
    (signal: AbortSignal) => schedulesApi.list(filters, signal),
    [filters],
  );
  const schedules = useCollection<ScheduleSummary>(loadSchedules);

  if (isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="Schedule history for your role is scoped to a department, and no department is attached to this account. Ask a college administrator to assign your department."
      />
    );
  }

  if (!canReadScheduleHistory(capability)) {
    return (
      <RestrictedState
        title="Schedule history is not available for your role"
        description="Persisted drafts and their version history belong to the scheduling roles. Instructors receive their timetable through their own view."
      />
    );
  }

  const showDepartmentFilter = canChooseAnyDepartment(capability);

  const columns: ColumnSpec<ScheduleSummary>[] = [
    {
      key: 'scope',
      header: 'Scope',
      render: (schedule) => (
        <Badge tone={schedule.scope === 'COLLEGE' ? 'info' : 'neutral'}>
          {formatScope(schedule.scope)}
        </Badge>
      ),
    },
    {
      key: 'semester',
      header: 'Semester',
      render: (schedule) => formatSemester(schedule.semester),
    },
    {
      key: 'department',
      header: 'Department',
      render: (schedule) =>
        schedule.scope === 'COLLEGE'
          ? 'College-wide'
          : (schedule.department?.code ?? DEPARTMENT_SCOPED_PLACEHOLDER),
    },
    {
      key: 'versions',
      header: 'Versions',
      render: (schedule) => String(schedule.version_count),
    },
    {
      key: 'latest',
      header: 'Latest version',
      render: (schedule) =>
        schedule.latest_version_number === null
          ? 'No version stored'
          : `V${schedule.latest_version_number}`,
    },
    {
      key: 'status',
      header: 'Latest status',
      render: (schedule) => (
        <Badge tone={scheduleStatusTone(schedule.latest_version_status)}>
          {formatScheduleStatus(schedule.latest_version_status)}
        </Badge>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      priority: 'secondary',
      render: (schedule) => formatTimestamp(schedule.created_at),
    },
    {
      key: 'updated',
      header: 'Updated',
      priority: 'secondary',
      render: (schedule) => formatTimestamp(schedule.updated_at),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Schedule History"
        description="Persisted schedules and their draft versions. Nothing here can be edited or deleted."
      />

      <Alert tone="info" title="Immutable history">
        {IMMUTABILITY_MESSAGE}
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <SemesterSelect
              id="schedules-semester"
              semesters={semesters.items}
              value={semesterId}
              onChange={setSemesterId}
              isLoading={semesters.status === 'loading'}
              label="Semester (optional)"
            />
            <div className="text-sm">
              <label
                htmlFor="schedules-scope"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Scope (optional)
              </label>
              <select
                id="schedules-scope"
                className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-2 text-sm"
                value={scope ?? ''}
                onChange={(event) =>
                  setScope(event.target.value === '' ? null : (event.target.value as ScheduleScope))
                }
              >
                <option value="">All scopes</option>
                {SCHEDULE_SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {showDepartmentFilter ? (
              <DepartmentSelect
                id="schedules-department"
                departments={departments.items}
                value={departmentId}
                onChange={setDepartmentId}
                isLoading={departments.status === 'loading'}
                label="Department (optional)"
              />
            ) : (
              <div className="text-sm">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Department
                </span>
                <p className="mt-1 flex h-10 items-center rounded-md border border-line bg-surface-muted px-3">
                  {user?.department ? `${user.department.code} — ${user.department.name}` : '—'}
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSemesterId(null);
                setScope(null);
                setDepartmentId(null);
              }}
            >
              Clear filters
            </Button>
            <Button size="sm" variant="ghost" onClick={() => schedules.reload()}>
              Refresh
            </Button>
          </div>
        </CardBody>
      </Card>

      {schedules.error ? (
        <Alert tone="danger" title="Schedules could not be loaded">
          {schedules.error.detail}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Persisted schedules</CardTitle>
        </CardHeader>
        <CardBody>
          {schedules.status === 'loading' && schedules.items.length === 0 ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading schedules…
            </p>
          ) : schedules.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No persisted schedule matches these filters. Generate and save a draft to create the
              first version.
            </p>
          ) : (
            <DataTable
              caption="Persisted schedules"
              columns={columns}
              items={schedules.items}
              getRowKey={(schedule) => schedule.id}
              renderRowActions={(schedule) => (
                <Link
                  className="underline text-sm"
                  href={SCHEDULING_ROUTES.scheduleDetail(schedule.id)}
                >
                  Open
                </Link>
              )}
              actionsHeader="Detail"
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
