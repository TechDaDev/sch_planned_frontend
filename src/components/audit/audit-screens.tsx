'use client';

import Link from 'next/link';
import * as React from 'react';

import { DataTable, type ColumnSpec } from '@/components/academic/data-table';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { DepartmentSelect, SemesterSelect } from '@/components/scheduling/scope-controls';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';
import { departmentsApi, semestersApi } from '@/lib/academic/api';
import type { Department, Semester } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import { auditApi } from '@/lib/scheduling/api';
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_SNAPSHOT_NOTICE,
  SCHEDULING_ROUTES,
} from '@/lib/scheduling/constants';
import {
  actorAccountRemoved,
  auditMetadataEntries,
  formatAuditAction,
  formatAuditActor,
  formatAuditDepartment,
  formatAuditSchedule,
  formatAuditSemester,
  formatAuditTimestamp,
  formatMetadataValue,
} from '@/lib/scheduling/audit';
import { canChooseAnyDepartment, canViewAudit, isDepartmentlessScopedUser } from '@/lib/scheduling/permissions';
import type { AuditAction, AuditEvent, AuditFilters } from '@/lib/scheduling/types';
import { useResource } from '@/lib/scheduling/use-resource';

function toDateTimeInputValue(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

/** Convert a date input value into the ISO timestamp the filter expects. */
function toFilterTimestamp(value: string, endOfDay: boolean): string | undefined {
  if (!value) {
    return undefined;
  }
  return `${value}T${endOfDay ? '23:59:59' : '00:00:00'}`;
}

/**
 * Administrative audit trail.
 *
 * Read-only: there is no request that writes an event, and the viewset exposes no
 * write verb. Actor identity is read from the event's own snapshot columns, because
 * the point of the trail is what was true when the operation happened.
 */
export function AuditScreen() {
  const { capability } = useAcademicUser();

  const [action, setAction] = React.useState<AuditAction | ''>('');
  const [semesterId, setSemesterId] = React.useState<number | null>(null);
  const [departmentId, setDepartmentId] = React.useState<number | null>(null);
  const [createdAfter, setCreatedAfter] = React.useState('');
  const [createdBefore, setCreatedBefore] = React.useState('');

  const loadDepartments = React.useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );
  const loadSemesters = React.useCallback((signal: AbortSignal) => semestersApi.list(signal), []);
  const departments = useCollection<Department>(loadDepartments);
  const semesters = useCollection<Semester>(loadSemesters);

  const filters = React.useMemo<AuditFilters>(() => {
    const after = toFilterTimestamp(createdAfter, false);
    const before = toFilterTimestamp(createdBefore, true);
    return {
      ...(action === '' ? {} : { action }),
      ...(semesterId === null ? {} : { semester: semesterId }),
      ...(departmentId === null ? {} : { department: departmentId }),
      ...(after === undefined ? {} : { created_after: after }),
      ...(before === undefined ? {} : { created_before: before }),
    };
  }, [action, semesterId, departmentId, createdAfter, createdBefore]);

  const loadEvents = React.useCallback(
    (signal: AbortSignal) => auditApi.list(filters, signal),
    [filters],
  );
  const events = useCollection<AuditEvent>(loadEvents);

  if (isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="The audit trail is scoped to a department for your role, and none is attached to this account."
      />
    );
  }

  if (!canViewAudit(capability)) {
    return (
      <RestrictedState
        title="The audit trail is not available for your role"
        description="Only college administrators and department administrators may read audit events."
      />
    );
  }

  const columns: ColumnSpec<AuditEvent>[] = [
    {
      key: 'created_at',
      header: 'When',
      render: (event) => formatAuditTimestamp(event.created_at),
    },
    {
      key: 'action',
      header: 'Action',
      render: (event) => (
        <Badge tone="info">{formatAuditAction(event.action)}</Badge>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (event) => (
        <span>
          {formatAuditActor(event.actor)}
          {actorAccountRemoved(event.actor) ? (
            <span className="block text-xs text-muted-foreground">account removed</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (event) => formatAuditDepartment(event),
    },
    {
      key: 'semester',
      header: 'Semester',
      priority: 'secondary',
      render: (event) => formatAuditSemester(event),
    },
    {
      key: 'schedule',
      header: 'Schedule',
      priority: 'secondary',
      render: (event) => formatAuditSchedule(event),
    },
    {
      key: 'object',
      header: 'Object',
      priority: 'secondary',
      render: (event) => `${event.object_type} #${event.object_id}`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Audit Trail"
        description="Security- and operations-significant scheduling operations, newest first. Reads, previews, validation runs and downloads are not audited."
      />

      <Alert tone="info" title="Actor identity is the event-time snapshot">
        {AUDIT_SNAPSHOT_NOTICE}
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Only the documented filters are used. They narrow the events your account may
            read and can never widen them.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="text-sm">
              <label
                htmlFor="audit-action"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Action
              </label>
              <select
                id="audit-action"
                className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-2 text-sm"
                value={action}
                onChange={(event) => setAction(event.target.value as AuditAction | '')}
              >
                <option value="">All actions</option>
                {AUDIT_ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <SemesterSelect
              id="audit-semester"
              semesters={semesters.items}
              value={semesterId}
              onChange={setSemesterId}
              label="Semester (optional)"
            />

            {canChooseAnyDepartment(capability) ? (
              <DepartmentSelect
                id="audit-department"
                departments={departments.items}
                value={departmentId}
                onChange={setDepartmentId}
                label="Department (optional)"
              />
            ) : null}

            <div className="text-sm">
              <label
                htmlFor="audit-after"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Created after
              </label>
              <input
                id="audit-after"
                type="date"
                className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-2 text-sm"
                value={toDateTimeInputValue(createdAfter)}
                onChange={(event) => setCreatedAfter(event.target.value)}
              />
            </div>
            <div className="text-sm">
              <label
                htmlFor="audit-before"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Created before
              </label>
              <input
                id="audit-before"
                type="date"
                className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-2 text-sm"
                value={toDateTimeInputValue(createdBefore)}
                onChange={(event) => setCreatedBefore(event.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setAction('');
                setSemesterId(null);
                setDepartmentId(null);
                setCreatedAfter('');
                setCreatedBefore('');
              }}
            >
              Clear filters
            </Button>
            <Button size="sm" variant="ghost" onClick={() => events.reload()}>
              Refresh
            </Button>
          </div>
        </CardBody>
      </Card>

      {events.error ? (
        <Alert tone="danger" title="Audit events could not be loaded">
          {events.error.detail}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardBody>
          {events.status === 'loading' && events.items.length === 0 ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading audit events…
            </p>
          ) : events.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No audit event matches these filters. College-wide operations store no
              department, so a department administrator never sees them.
            </p>
          ) : (
            <DataTable
              caption="Audit events"
              columns={columns}
              items={events.items}
              getRowKey={(event) => event.id}
              renderRowActions={(event) => (
                <Link className="text-sm underline" href={SCHEDULING_ROUTES.auditDetail(event.id)}>
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

export interface AuditDetailScreenProps {
  eventId: string;
}

/** One audit event, with its structured metadata rendered as text. */
export function AuditDetailScreen({ eventId }: AuditDetailScreenProps) {
  const { capability } = useAcademicUser();

  const loadEvent = React.useCallback(
    (signal: AbortSignal) => auditApi.get(eventId, signal),
    [eventId],
  );
  const event = useResource<AuditEvent>(loadEvent);

  if (isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="The audit trail is scoped to a department for your role."
      />
    );
  }

  if (!canViewAudit(capability)) {
    return (
      <RestrictedState
        title="The audit trail is not available for your role"
        description="Only college administrators and department administrators may read audit events."
      />
    );
  }

  const metadata = event.data ? auditMetadataEntries(event.data) : [];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Audit Event"
        description="One recorded operation. The trail is append-only and read-only."
      />

      {event.error ? (
        <Alert tone="danger" title="Audit event could not be loaded">
          <p>{event.error.detail}</p>
          <p className="mt-1 text-xs">
            An event outside your scope answers as not found, so its existence is not
            revealed.
          </p>
        </Alert>
      ) : null}

      {event.isInitialLoad ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading audit event…
        </p>
      ) : null}

      {event.data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{formatAuditAction(event.data.action)}</CardTitle>
              <CardDescription>{formatAuditTimestamp(event.data.created_at)}</CardDescription>
            </CardHeader>
            <CardBody>
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Actor</dt>
                  <dd>
                    {formatAuditActor(event.data.actor)}
                    {actorAccountRemoved(event.data.actor) ? (
                      <span className="block text-xs text-muted-foreground">
                        The account was removed after this event. The recorded identity is
                        kept.
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Department
                  </dt>
                  <dd>{formatAuditDepartment(event.data)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Semester
                  </dt>
                  <dd>{formatAuditSemester(event.data)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Schedule
                  </dt>
                  <dd>{formatAuditSchedule(event.data)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Schedule version
                  </dt>
                  <dd>
                    {event.data.schedule_version
                      ? `#${event.data.schedule_version.id} · V${event.data.schedule_version.version_number} · ${event.data.schedule_version.status}`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Object
                  </dt>
                  <dd>
                    {event.data.object_type} #{event.data.object_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Request id
                  </dt>
                  <dd>
                    <code className="text-xs">{event.data.request_id}</code>
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
              <CardDescription>
                Structured operational data recorded with the event. Rendered as text.
              </CardDescription>
            </CardHeader>
            <CardBody>
              {metadata.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This event records no additional metadata.
                </p>
              ) : (
                <dl className="grid gap-3 text-sm sm:grid-cols-[minmax(10rem,auto)_1fr]">
                  {metadata.map((entry) => (
                    <React.Fragment key={entry.key}>
                      <dt className="font-medium text-muted-foreground">{entry.key}</dt>
                      <dd className="break-words">{formatMetadataValue(entry.value)}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              )}
            </CardBody>
          </Card>

          <Link className="text-sm underline" href={SCHEDULING_ROUTES.audit}>
            Back to the audit trail
          </Link>
        </>
      ) : null}
    </div>
  );
}
