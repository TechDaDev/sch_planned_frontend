'use client';

import Link from 'next/link';
import * as React from 'react';

import { DataTable, type ColumnSpec } from '@/components/academic/data-table';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { VersionComparisonCard } from '@/components/scheduling/version-comparison';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';
import { useCollection } from '@/lib/academic/use-collection';
import { schedulesApi } from '@/lib/scheduling/api';
import {
  IMMUTABILITY_MESSAGE,
  SCHEDULING_ROUTES,
} from '@/lib/scheduling/constants';
import {
  formatDepartment,
  formatScheduleStatus,
  formatScope,
  formatSemester,
  formatVersionSource,
  scheduleStatusTone,
} from '@/lib/scheduling/formatters';
import { canReadScheduleHistory } from '@/lib/scheduling/permissions';
import type { ScheduleDetail, ScheduleVersionSummary } from '@/lib/scheduling/types';
import { useResource } from '@/lib/scheduling/use-resource';

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}` : value;
}

function IdentityRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export interface ScheduleDetailScreenProps {
  scheduleId: number;
}

/**
 * One persisted schedule: identity, newest version and full history.
 *
 * The page is read-only. Workflow statuses returned by the backend are displayed
 * as metadata; no submit, review, approve or publish control exists here.
 */
export function ScheduleDetailScreen({ scheduleId }: ScheduleDetailScreenProps) {
  const { capability } = useAcademicUser();

  const loadSchedule = React.useCallback(
    (signal: AbortSignal) => schedulesApi.get(scheduleId, signal),
    [scheduleId],
  );
  const loadVersions = React.useCallback(
    (signal: AbortSignal) => schedulesApi.versions(scheduleId, signal),
    [scheduleId],
  );

  const scheduleResource = useResource<ScheduleDetail>(loadSchedule);
  const versionCollection = useCollection<ScheduleVersionSummary>(loadVersions);

  const schedule = scheduleResource.data;
  const versions = versionCollection.items;
  const error = scheduleResource.error?.detail ?? null;

  if (!canReadScheduleHistory(capability)) {
    return (
      <RestrictedState
        title="Schedule history is not available for your role"
        description="Persisted drafts and their version history belong to the scheduling roles."
      />
    );
  }

  const columns: ColumnSpec<ScheduleVersionSummary>[] = [
    {
      key: 'version',
      header: 'Version',
      render: (version) => `V${version.version_number}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (version) => (
        <Badge tone={scheduleStatusTone(version.status)}>
          {formatScheduleStatus(version.status)}
        </Badge>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (version) => formatVersionSource(version.source),
    },
    {
      key: 'parent',
      header: 'Parent',
      render: (version) => (version.parent_version ? `#${version.parent_version}` : '—'),
    },
    {
      key: 'entry_count',
      header: 'Sessions',
      render: (version) => String(version.entry_count),
    },
    {
      key: 'solver',
      header: 'Solver',
      priority: 'secondary',
      render: (version) =>
        version.solver_status ? (
          <span title={version.solver_status}>{version.solver_status}</span>
        ) : (
          'No solver run'
        ),
    },
    {
      key: 'objective',
      header: 'Objective',
      priority: 'secondary',
      render: (version) =>
        version.objective_value === null || version.objective_value === undefined
          ? '—'
          : String(version.objective_value),
    },
    {
      key: 'created_by',
      header: 'Created by',
      priority: 'secondary',
      render: (version) => version.created_by?.username ?? '—',
    },
    {
      key: 'created_at',
      header: 'Created',
      priority: 'secondary',
      render: (version) => formatTimestamp(version.created_at),
    },
    {
      key: 'notes',
      header: 'Notes',
      priority: 'secondary',
      render: (version) =>
        version.notes && version.notes.length > 0 ? version.notes : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title={schedule ? `Schedule #${schedule.id}` : `Schedule #${scheduleId}`}
        description="One logical schedule with its complete, immutable version history."
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              scheduleResource.reload();
              versionCollection.reload();
            }}
          >
            Refresh
          </Button>
        }
      />

      {error ? (
        <Alert tone="danger" title="Schedule could not be loaded">
          <p>{error}</p>
          <p className="mt-1 text-xs">
            A schedule outside your scope answers as not found, so its existence is not revealed.
          </p>
        </Alert>
      ) : null}

      {scheduleResource.isInitialLoad ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading schedule…
        </p>
      ) : null}

      {schedule ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Schedule identity</CardTitle>
              <CardDescription>{IMMUTABILITY_MESSAGE}</CardDescription>
            </CardHeader>
            <CardBody>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <IdentityRow
                  label="Scope"
                  value={
                    <Badge tone={schedule.scope === 'COLLEGE' ? 'info' : 'neutral'}>
                      {formatScope(schedule.scope)}
                    </Badge>
                  }
                />
                <IdentityRow
                  label="Semester"
                  value={formatSemester(schedule.semester)}
                />
                <IdentityRow
                  label="Department"
                  value={
                    schedule.scope === 'COLLEGE'
                      ? 'College-wide'
                      : formatDepartment(schedule.department)
                  }
                />
                <IdentityRow label="Versions stored" value={String(schedule.version_count)} />
                <IdentityRow
                  label="Latest version"
                  value={
                    schedule.latest_version_number === null
                      ? 'No version stored'
                      : `V${schedule.latest_version_number}`
                  }
                />
                <IdentityRow
                  label="Latest status"
                  value={
                    <Badge tone={scheduleStatusTone(schedule.latest_version_status)}>
                      {formatScheduleStatus(schedule.latest_version_status)}
                    </Badge>
                  }
                />
                <IdentityRow label="Created" value={formatTimestamp(schedule.created_at)} />
                <IdentityRow label="Updated" value={formatTimestamp(schedule.updated_at)} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Latest version</CardTitle>
            </CardHeader>
            <CardBody>
              {schedule.latest_version ? (
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <IdentityRow
                    label="Version"
                    value={`V${schedule.latest_version.version_number}`}
                  />
                  <IdentityRow
                    label="Status"
                    value={
                      <Badge tone={scheduleStatusTone(schedule.latest_version.status)}>
                        {formatScheduleStatus(schedule.latest_version.status)}
                      </Badge>
                    }
                  />
                  <IdentityRow
                    label="Source"
                    value={formatVersionSource(schedule.latest_version.source)}
                  />
                  <IdentityRow
                    label="Sessions"
                    value={String(schedule.latest_version.entry_count)}
                  />
                  <div className="sm:col-span-2 lg:col-span-4">
                    <Link
                      className="text-sm underline"
                      href={SCHEDULING_ROUTES.versionDetail(schedule.latest_version.id)}
                    >
                      Open version V{schedule.latest_version.version_number}
                    </Link>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No version has been stored for this schedule yet.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Published pointer</CardTitle>
              <CardDescription>
                Which version is currently official. Publication is a Frontend F4 workflow action;
                this page only reads the pointer.
              </CardDescription>
            </CardHeader>
            <CardBody>
              {schedule.published_version ? (
                <dl className="grid gap-3 sm:grid-cols-3">
                  <IdentityRow
                    label="Published version"
                    value={`V${schedule.published_version_number ?? '—'}`}
                  />
                  <IdentityRow
                    label="Published at"
                    value={formatTimestamp(schedule.published_at)}
                  />
                  <IdentityRow
                    label="Version id"
                    value={
                      <Link
                        className="underline"
                        href={SCHEDULING_ROUTES.versionDetail(schedule.published_version)}
                      >
                        #{schedule.published_version}
                      </Link>
                    }
                  />
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No version of this schedule is published.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
              <CardDescription>Newest first, as the backend orders it.</CardDescription>
            </CardHeader>
            <CardBody>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No version has been stored for this schedule yet.
                </p>
              ) : (
                <DataTable
                  caption="Schedule versions"
                  columns={columns}
                  items={versions}
                  getRowKey={(version) => version.id}
                  renderRowActions={(version) => (
                    <Link
                      className="text-sm underline"
                      href={SCHEDULING_ROUTES.versionDetail(version.id)}
                    >
                      Open V{version.version_number}
                    </Link>
                  )}
                  actionsHeader="Detail"
                />
              )}
            </CardBody>
          </Card>

          <VersionComparisonCard scheduleId={schedule.id} versions={versions} />
        </>
      ) : null}
    </div>
  );
}
