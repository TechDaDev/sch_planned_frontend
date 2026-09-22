'use client';

import Link from 'next/link';
import * as React from 'react';

import { useAcademicUser } from '@/components/academic/use-academic-user';
import { AnalyticsReport } from '@/components/scheduling/analytics-report';
import { ExportButtons } from '@/components/scheduling/export-buttons';
import { SemesterSelect } from '@/components/scheduling/scope-controls';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';
import { semestersApi } from '@/lib/academic/api';
import type { Semester } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import {
  analyticsApi,
  publishedExportApi,
  scheduleVersionsApi,
  versionExportApi,
} from '@/lib/scheduling/api';
import { SCHEDULING_ROUTES } from '@/lib/scheduling/constants';
import {
  formatScheduleStatus,
  formatScope,
  formatSemester,
  formatVersionSource,
} from '@/lib/scheduling/formatters';
import {
  canAccessReports,
  canExportPublished,
  canExportVersion,
  canViewPublishedAnalytics,
  canViewVersionAnalytics,
  isDepartmentlessScopedUser,
} from '@/lib/scheduling/permissions';
import type { ScheduleAnalyticsResult } from '@/lib/scheduling/types';
import { useResource } from '@/lib/scheduling/use-resource';

/** Reports landing page: the two report families and their export controls. */
export function ReportsLandingScreen() {
  const { capability } = useAcademicUser();

  if (isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="Reports are scoped to a department, and none is attached to this account."
      />
    );
  }

  if (!canAccessReports(capability)) {
    return (
      <RestrictedState
        title="Reports are not available for your role"
        description="Analytics and exports are management views. Instructors receive their timetable through My Timetable."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Version analytics and exports</CardTitle>
          <CardDescription>
            A report of one exact stored version, plus its Excel and PDF downloads. Open a
            version from the schedule history to read its report.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <Link className="text-sm underline" href={SCHEDULING_ROUTES.schedules}>
            Open schedule history
          </Link>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published analytics and exports</CardTitle>
          <CardDescription>
            The same report shape, computed over the current official publication of a
            semester.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <Link className="text-sm underline" href={SCHEDULING_ROUTES.publishedReport}>
            Open published analytics
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

export interface VersionReportScreenProps {
  versionId: number;
}

/**
 * Analytics and exports of one stored version.
 *
 * The report is computed by the backend for this exact version, whatever its status,
 * and every descriptive value is a snapshot reference from the response.
 */
export function VersionReportScreen({ versionId }: VersionReportScreenProps) {
  const { capability } = useAcademicUser();

  const loadReport = React.useCallback(
    (signal: AbortSignal) => analyticsApi.forVersion(versionId, signal),
    [versionId],
  );
  const loadVersion = React.useCallback(
    (signal: AbortSignal) => scheduleVersionsApi.get(versionId, signal),
    [versionId],
  );
  const report = useResource<ScheduleAnalyticsResult>(loadReport);
  const version = useResource(loadVersion);

  if (isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="Reports are scoped to a department, and none is attached to this account."
      />
    );
  }

  if (!canViewVersionAnalytics(capability)) {
    return (
      <RestrictedState
        title="Version analytics are not available for your role"
        description="Reading a version report belongs to the college administrator, department administrator, scheduler and viewer roles."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Version Report"
        description="Counts, workloads, room usage, gaps and quality figures of one stored version."
      />

      {report.error ? (
        <Alert tone="danger" title="Report could not be loaded">
          <p>{report.error.detail}</p>
          <p className="mt-1 text-xs">
            A version outside your scope answers as not found, so its existence is not
            revealed.
          </p>
        </Alert>
      ) : null}

      {report.status === 'loading' && !report.data ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading report…
        </p>
      ) : null}

      {version.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Version</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="neutral">V{version.data.version_number}</Badge>
              <span>{formatScheduleStatus(version.data.status)}</span>
              <span className="text-muted-foreground">
                {formatVersionSource(version.data.source)} ·{' '}
                {formatScope(version.data.schedule.scope)} ·{' '}
                {formatSemester(version.data.schedule.semester)}
              </span>
              <Link
                className="underline"
                href={SCHEDULING_ROUTES.versionDetail(version.data.id)}
              >
                Open the version
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {report.data ? <AnalyticsReport report={report.data} title="Version analytics" /> : null}

      {canExportVersion(capability) && report.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Export this version</CardTitle>
            <CardDescription>
              The backend builds the workbook and the PDF from this version&apos;s own
              snapshots. Nothing is generated in the browser.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <ExportButtons
              kind="version"
              fetchXlsx={(signal) => versionExportApi.xlsx(versionId, signal)}
              fetchPdf={(signal) => versionExportApi.pdf(versionId, signal)}
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

/** Analytics and exports of the current official publication of a semester. */
export function PublishedReportScreen() {
  const { capability } = useAcademicUser();
  const [semesterId, setSemesterId] = React.useState<number | null>(null);

  const loadSemesters = React.useCallback((signal: AbortSignal) => semestersApi.list(signal), []);
  const semesters = useCollection<Semester>(loadSemesters);
  const activeSemester = semesters.items.find((semester) => semester.is_active) ?? null;
  const effectiveSemesterId = semesterId ?? activeSemester?.id ?? null;

  const loadReport = React.useCallback(
    (signal: AbortSignal) =>
      effectiveSemesterId === null
        ? Promise.resolve<ScheduleAnalyticsResult | null>(null)
        : analyticsApi.forPublished(effectiveSemesterId, signal),
    [effectiveSemesterId],
  );
  const report = useResource<ScheduleAnalyticsResult | null>(loadReport);

  if (isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="Published analytics are scoped to a department, and none is attached to this account."
      />
    );
  }

  if (!canViewPublishedAnalytics(capability)) {
    return (
      <RestrictedState
        title="Published analytics are not available for your role"
        description="Analytics are a management view. Instructors read the official timetable through My Timetable."
      />
    );
  }

  const notPublished =
    report.error !== null &&
    (report.error.status === 404 || /not been published/i.test(report.error.detail ?? ''));

  return (
    <div className="space-y-6">
      <PageHeading
        title="Published Analytics"
        description="Analytics of the current official publication. The analysed version comes from the published-version pointer."
      />

      <Card>
        <CardHeader>
          <CardTitle>Semester</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="max-w-md">
            <SemesterSelect
              id="published-analytics-semester"
              semesters={semesters.items}
              value={effectiveSemesterId}
              onChange={setSemesterId}
              isLoading={semesters.status === 'loading'}
            />
          </div>
        </CardBody>
      </Card>

      {report.error && !notPublished ? (
        <Alert tone="danger" title="Published analytics could not be loaded">
          {report.error.detail}
        </Alert>
      ) : null}

      {notPublished ? (
        <Alert tone="info" title="No official timetable has been published yet">
          No college schedule of this semester has been published, so there is nothing to
          analyse. A draft is not a publication.
        </Alert>
      ) : null}

      {report.data ? (
        <AnalyticsReport report={report.data} title="Published analytics" />
      ) : null}

      {report.data && effectiveSemesterId !== null && canExportPublished(capability) ? (
        <Card>
          <CardHeader>
            <CardTitle>Export the official timetable</CardTitle>
            <CardDescription>
              A department-scoped download contains the sessions that department may see, not
              the whole college.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <ExportButtons
              kind="published"
              fetchXlsx={(signal) => publishedExportApi.xlsx(effectiveSemesterId, signal)}
              fetchPdf={(signal) => publishedExportApi.pdf(effectiveSemesterId, signal)}
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
