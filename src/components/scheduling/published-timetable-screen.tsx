'use client';

import Link from 'next/link';
import * as React from 'react';

import { useAcademicUser } from '@/components/academic/use-academic-user';
import { ExportButtons } from '@/components/scheduling/export-buttons';
import { TimetableView } from '@/components/scheduling/timetable-view';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';
import { semestersApi } from '@/lib/academic/api';
import type { Semester } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import { ApiClientError } from '@/lib/api/errors';
import { publishedScheduleApi, publishedExportApi } from '@/lib/scheduling/api';
import {
  OFFICIAL_TIMETABLE_NOTICE,
  SCHEDULING_ROUTES,
} from '@/lib/scheduling/constants';
import { formatSemester } from '@/lib/scheduling/formatters';
import { sessionsFromEntries } from '@/lib/scheduling/normalization';
import {
  canExportPublished,
  canViewPublishedTimetable,
  isDepartmentlessScopedUser,
} from '@/lib/scheduling/permissions';
import { SemesterSelect } from '@/components/scheduling/scope-controls';
import { useResource } from '@/lib/scheduling/use-resource';
import type { PublishedScheduleResult } from '@/lib/scheduling/types';

export interface PublishedTimetableScreenProps {
  /** Instructor-facing copy when true: no export or report controls. */
  instructorView?: boolean;
}

/**
 * The official published timetable of one semester.
 *
 * The analysed version comes from the backend's published-version pointer, never from
 * a version that happens to carry the PUBLISHED status, so a newer draft can never
 * replace the official view. Entries are rendered from the version's own snapshots:
 * renaming a live course, room, department, instructor or group does not rewrite the
 * official timetable. A semester with no publication is an empty state — never a
 * fallback to a draft.
 */
export function PublishedTimetableScreen({
  instructorView = false,
}: PublishedTimetableScreenProps) {
  const { capability } = useAcademicUser();
  const [semesterId, setSemesterId] = React.useState<number | null>(null);

  const loadSemesters = React.useCallback((signal: AbortSignal) => semestersApi.list(signal), []);
  const semesters = useCollection<Semester>(loadSemesters);

  // Default to the active semester of the college once the list arrives.
  const activeSemester = semesters.items.find((semester) => semester.is_active) ?? null;
  const effectiveSemesterId = semesterId ?? activeSemester?.id ?? null;

  const loadPublished = React.useCallback(
    (signal: AbortSignal) =>
      effectiveSemesterId === null
        ? Promise.resolve<PublishedScheduleResult | null>(null)
        : publishedScheduleApi.current(effectiveSemesterId, signal),
    [effectiveSemesterId],
  );
  const published = useResource<PublishedScheduleResult | null>(loadPublished);

  const notPublished =
    published.error !== null &&
    (published.error.status === 404 ||
      /not been published/i.test(published.error.detail ?? ''));

  const sessions = React.useMemo(
    () => sessionsFromEntries(published.data?.entries ?? []),
    [published.data],
  );

  if (!canViewPublishedTimetable(capability)) {
    return (
      <RestrictedState
        title="Not available for your role"
        description="The published timetable is available to signed-in accounts only."
      />
    );
  }

  if (!instructorView && isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="Your published-timetable scope comes from your department, and none is attached to this account."
      />
    );
  }

  const showDepartment = published.data?.schedule.scope === 'COLLEGE';

  return (
    <div className="space-y-6">
      <PageHeading
        title={instructorView ? 'My Timetable' : 'Official Timetable'}
        description={
          instructorView
            ? 'The sessions you teach in the officially published timetable.'
            : 'The current official publication for a semester. Only the published-version pointer decides which version is official.'
        }
      />

      {!instructorView ? (
        <Alert tone="info" title="Official published timetable">
          {OFFICIAL_TIMETABLE_NOTICE}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Semester</CardTitle>
          <CardDescription>
            A semester without a publication has no official timetable yet.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="max-w-md">
            <SemesterSelect
              id={instructorView ? 'my-timetable-semester' : 'published-semester'}
              semesters={semesters.items}
              value={effectiveSemesterId}
              onChange={setSemesterId}
              isLoading={semesters.status === 'loading'}
            />
          </div>
        </CardBody>
      </Card>

      {published.error && !notPublished ? (
        <Alert tone="danger" title="The official timetable could not be loaded">
          {published.error.detail}
        </Alert>
      ) : null}

      {semesters.status === 'success' && semesters.items.length === 0 ? (
        <Alert tone="info" title="No semester is configured">
          Add a semester in Academic Setup before an official timetable can exist.
        </Alert>
      ) : null}

      {notPublished ? (
        <Alert tone="info" title="No official timetable has been published yet">
          <p>
            No college schedule of this semester has been published, so there is nothing to
            show here. A draft is not a publication.
          </p>
          {!instructorView ? (
            <Link className="mt-1 inline-block underline" href={SCHEDULING_ROUTES.schedules}>
              Open schedule history
            </Link>
          ) : null}
        </Alert>
      ) : null}

      {published.data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Publication</CardTitle>
              <CardDescription>Identity of the version that is official right now.</CardDescription>
            </CardHeader>
            <CardBody>
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Official version
                  </dt>
                  <dd>V{published.data.version.version_number}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Semester
                  </dt>
                  <dd>{formatSemester(published.data.semester)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Published at
                  </dt>
                  <dd>{published.data.version.published_at ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Published by
                  </dt>
                  <dd>{published.data.version.published_by?.username ?? '—'}</dd>
                </div>
              </dl>
              {!instructorView ? (
                <Link
                  className="mt-3 inline-block text-sm underline"
                  href={SCHEDULING_ROUTES.versionDetail(published.data.version.id)}
                >
                  Open this version
                </Link>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {instructorView ? 'Your published sessions' : 'Official timetable'}
              </CardTitle>
              <CardDescription>
                {sessions.length} session{sessions.length === 1 ? '' : 's'} visible to your
                account. Values are the published version&apos;s own snapshots.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <TimetableView
                sessions={sessions}
                showDepartment={showDepartment}
                emptyMessage={
                  instructorView
                    ? 'No published session is assigned to you in this semester.'
                    : 'No published session is visible to your account in this semester.'
                }
              />
            </CardBody>
          </Card>

          {!instructorView ? (
            <Card>
              <CardHeader>
                <CardTitle>Export the official timetable</CardTitle>
                <CardDescription>
                  Published exports follow the same scope as this page: a department sees
                  its own managed and joint sessions, not the whole college.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <ExportButtons
                  kind="published"
                  allowed={canExportPublished(capability) && effectiveSemesterId !== null}
                  disabledReason="Your role may not download published exports."
                  fetchXlsx={(signal) =>
                    publishedExportApi.xlsx(effectiveSemesterId as number, signal)
                  }
                  fetchPdf={(signal) =>
                    publishedExportApi.pdf(effectiveSemesterId as number, signal)
                  }
                />
              </CardBody>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Narrow a 404 from the published endpoint to the "not published" state. */
export function isNotPublishedError(error: ApiClientError | null): boolean {
  return error !== null && error.status === 404;
}
