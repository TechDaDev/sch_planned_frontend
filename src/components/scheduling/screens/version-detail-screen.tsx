'use client';

import Link from 'next/link';
import * as React from 'react';

import { useAcademicUser } from '@/components/academic/use-academic-user';
import { SolverReportView } from '@/components/scheduling/generation-report';
import { TimetableView } from '@/components/scheduling/timetable-view';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';
import { useCollection } from '@/lib/academic/use-collection';
import { scheduleVersionsApi } from '@/lib/scheduling/api';
import {
  IMMUTABILITY_MESSAGE,
  SCHEDULING_ROUTES,
  SNAPSHOT_MESSAGE,
} from '@/lib/scheduling/constants';
import {
  formatScheduleStatus,
  formatScope,
  formatSemester,
  formatVersionSource,
  scheduleStatusTone,
} from '@/lib/scheduling/formatters';
import { sessionsFromEntries } from '@/lib/scheduling/normalization';
import { canReadScheduleHistory } from '@/lib/scheduling/permissions';
import type { ScheduleEntry, ScheduleVersionDetail } from '@/lib/scheduling/types';
import { useResource } from '@/lib/scheduling/use-resource';

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}` : value;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export interface VersionDetailScreenProps {
  versionId: number;
}

/**
 * One persisted version: provenance, solver metadata and its stored sessions.
 *
 * The timetable is rendered from the version's own snapshot columns, so a course,
 * room, department, instructor or group renamed later does not change what this
 * version shows.
 */
export function VersionDetailScreen({ versionId }: VersionDetailScreenProps) {
  const { capability } = useAcademicUser();

  const loadVersion = React.useCallback(
    (signal: AbortSignal) => scheduleVersionsApi.get(versionId, signal),
    [versionId],
  );
  const loadEntries = React.useCallback(
    (signal: AbortSignal) => scheduleVersionsApi.entries(versionId, {}, signal),
    [versionId],
  );

  const versionResource = useResource<ScheduleVersionDetail>(loadVersion);
  const entryCollection = useCollection<ScheduleEntry>(loadEntries);

  const version = versionResource.data;
  const error = versionResource.error?.detail ?? entryCollection.error?.detail ?? null;

  if (!canReadScheduleHistory(capability)) {
    return (
      <RestrictedState
        title="Schedule history is not available for your role"
        description="Persisted versions and their sessions belong to the scheduling roles."
      />
    );
  }

  const sessions = sessionsFromEntries(entryCollection.items);
  const isCollege = version?.schedule.scope === 'COLLEGE';

  return (
    <div className="space-y-6">
      <PageHeading
        title={version ? `Version V${version.version_number}` : `Version #${versionId}`}
        description="A stored, immutable snapshot of a generated timetable."
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              versionResource.reload();
              entryCollection.reload();
            }}
          >
            Refresh
          </Button>
        }
      />

      {error ? (
        <Alert tone="danger" title="Version could not be loaded">
          <p>{error}</p>
          <p className="mt-1 text-xs">
            A version outside your scope answers as not found, so its existence is not revealed.
          </p>
        </Alert>
      ) : null}

      {versionResource.isInitialLoad ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading version…
        </p>
      ) : null}

      {version ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Version provenance</CardTitle>
              <CardDescription>{IMMUTABILITY_MESSAGE}</CardDescription>
            </CardHeader>
            <CardBody>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Row
                  label="Schedule"
                  value={
                    <Link
                      className="underline"
                      href={SCHEDULING_ROUTES.scheduleDetail(version.schedule.id)}
                    >
                      #{version.schedule.id} · {formatScope(version.schedule.scope)}
                    </Link>
                  }
                />
                <Row label="Semester" value={formatSemester(version.schedule.semester)} />
                <Row
                  label="Department"
                  value={
                    version.schedule.scope === 'COLLEGE'
                      ? 'College-wide'
                      : (version.schedule.department?.code ?? '—')
                  }
                />
                <Row label="Version" value={`V${version.version_number}`} />
                <Row
                  label="Status"
                  value={
                    <Badge tone={scheduleStatusTone(version.status)}>
                      {formatScheduleStatus(version.status)}
                    </Badge>
                  }
                />
                <Row label="Source" value={formatVersionSource(version.source)} />
                <Row
                  label="Parent version"
                  value={version.parent_version ? `#${version.parent_version}` : '—'}
                />
                <Row
                  label="Created by"
                  value={
                    version.created_by
                      ? `${version.created_by.username} (${version.created_by.role})`
                      : '—'
                  }
                />
                <Row label="Created" value={formatTimestamp(version.created_at)} />
                <Row label="Stored sessions" value={String(version.entry_count)} />
                <Row
                  label="Published pointer"
                  value={version.is_published_current ? 'Current publication' : 'Not current'}
                />
                <Row label="Notes" value={version.notes ?? '—'} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version actions</CardTitle>
              <CardDescription>
                Manual editing and workflow are separate destinations. Each one re-checks
                your role, the version status and the schedule scope before offering or
                performing anything.
              </CardDescription>
            </CardHeader>
            <CardBody className="flex flex-wrap gap-3">
              <Link
                className="text-sm underline"
                href={SCHEDULING_ROUTES.versionEdit(version.id)}
              >
                Edit this version manually
              </Link>
              <Link
                className="text-sm underline"
                href={SCHEDULING_ROUTES.versionWorkflow(version.id)}
              >
                Workflow and validation
              </Link>
              <Link
                className="text-sm underline"
                href={SCHEDULING_ROUTES.versionReport(version.id)}
              >
                Analytics report
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Solver metadata</CardTitle>
              <CardDescription>
                Recorded when this version was generated. A manual version stores none, because no
                engine produced it.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              {version.solver_status ? (
                <SolverReportView
                  solver={{
                    status: version.solver_status,
                    objective_value: version.objective_value ?? null,
                    wall_time_seconds: version.solver_wall_time_seconds ?? null,
                    num_conflicts: version.solver_num_conflicts ?? null,
                    num_branches: version.solver_num_branches ?? null,
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No solver run is recorded for this version.
                </p>
              )}
            </CardBody>
          </Card>

          {version.validation_summary || version.generation_summary ? (
            <Card>
              <CardHeader>
                <CardTitle>Recorded summaries</CardTitle>
              </CardHeader>
              <CardBody>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Row
                    label="Validation summary"
                    value={<pre className="text-xs">{JSON.stringify(version.validation_summary ?? {}, null, 2)}</pre>}
                  />
                  <Row
                    label="Generation summary"
                    value={<pre className="text-xs">{JSON.stringify(version.generation_summary ?? {}, null, 2)}</pre>}
                  />
                </dl>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Workflow metadata</CardTitle>
              <CardDescription>
                Recorded by the backend when this version moved through the workflow. The
                transitions themselves are performed on the version workflow page.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Row
                  label="Submitted by"
                  value={`${version.submitted_by?.username ?? '—'} · ${formatTimestamp(version.submitted_at)}`}
                />
                <Row
                  label="Reviewed by"
                  value={`${version.reviewed_by?.username ?? '—'} · ${formatTimestamp(version.reviewed_at)}`}
                />
                <Row
                  label="Approved by"
                  value={`${version.approved_by?.username ?? '—'} · ${formatTimestamp(version.approved_at)}`}
                />
                <Row
                  label="Published by"
                  value={`${version.published_by?.username ?? '—'} · ${formatTimestamp(version.published_at)}`}
                />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stored timetable</CardTitle>
              <CardDescription>{SNAPSHOT_MESSAGE}</CardDescription>
            </CardHeader>
            <CardBody>
              <TimetableView
                sessions={sessions}
                showDepartment={isCollege}
                emptyMessage="This version stores no session."
              />
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
