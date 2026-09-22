'use client';

import * as React from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api/errors';
import { scheduleVersionsApi } from '@/lib/scheduling/api';
import { compareSessions } from '@/lib/scheduling/comparison';
import { SESSION_CHANGE_LABELS } from '@/lib/scheduling/constants';
import {
  formatDay,
  formatInstructorList,
  formatRoom,
  formatTimeRange,
} from '@/lib/scheduling/formatters';
import { sessionsFromEntries } from '@/lib/scheduling/normalization';
import type {
  ScheduleVersionSummary,
  SessionChange,
  SessionChangeKind,
  TimetableComparison,
  TimetableSession,
} from '@/lib/scheduling/types';

function toNumberOrNull(value: string): number | null {
  return value === '' ? null : Number(value);
}

function changeTone(kind: SessionChangeKind): 'neutral' | 'info' | 'warning' | 'success' {
  if (kind === 'ADDED') {
    return 'success';
  }
  if (kind === 'REMOVED') {
    return 'warning';
  }
  return 'info';
}

/** One side of a changed session, stated as text. */
function SessionSnapshot({ session }: { session: TimetableSession | null }) {
  if (!session) {
    return <span className="text-muted-foreground">Not present</span>;
  }
  return (
    <dl className="space-y-0.5 text-xs">
      <div>
        <dt className="inline text-muted-foreground">When: </dt>
        <dd className="inline">
          {session.dayDisplay || formatDay(session.dayOfWeek)}{' '}
          {formatTimeRange(session.startTime, session.endTime)}
        </dd>
      </div>
      <div>
        <dt className="inline text-muted-foreground">Room: </dt>
        <dd className="inline">{formatRoom(session.room)}</dd>
      </div>
      <div>
        <dt className="inline text-muted-foreground">Course: </dt>
        <dd className="inline">
          {session.course.code} — {session.course.name} ·{' '}
          {session.teachingComponent.component_type}
          {session.teachingComponent.label ? ` (${session.teachingComponent.label})` : ''}
        </dd>
      </div>
      <div>
        <dt className="inline text-muted-foreground">Instructors: </dt>
        <dd className="inline">{formatInstructorList(session.instructors)}</dd>
      </div>
      <div>
        <dt className="inline text-muted-foreground">Groups: </dt>
        <dd className="inline">
          {session.studentGroups.map((group) => group.code).join(', ') || 'No student group'}
        </dd>
      </div>
      <div>
        <dt className="inline text-muted-foreground">Penalty: </dt>
        <dd className="inline">{session.penalty}</dd>
      </div>
    </dl>
  );
}

function ComparisonResult({ comparison }: { comparison: TimetableComparison }) {
  const [showUnchangedNote, setShowUnchangedNote] = React.useState(false);

  const groups: { kind: SessionChangeKind; rows: SessionChange[] }[] = [];
  for (const change of comparison.changes) {
    const bucket = groups.find((group) => group.kind === change.kind);
    if (bucket) {
      bucket.rows.push(change);
    } else {
      groups.push({ kind: change.kind, rows: [change] });
    }
  }

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Changed</dt>
          <dd>{comparison.changedCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Added</dt>
          <dd>{comparison.addedCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Removed</dt>
          <dd>{comparison.removedCount}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Unchanged</dt>
          <dd>{comparison.unchangedCount}</dd>
        </div>
      </dl>

      {comparison.changedCount === 0 ? (
        <Alert tone="success" title="No difference between the two versions">
          Every stored session has the same time, room and content in both versions.
        </Alert>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.kind} aria-label={SESSION_CHANGE_LABELS[group.kind]}>
              <h3 className="text-sm font-semibold">
                {SESSION_CHANGE_LABELS[group.kind]} ({group.rows.length})
              </h3>
              <ul className="mt-2 space-y-2">
                {group.rows.map((row) => (
                  <li key={row.sessionId} className="rounded-md border border-line px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={changeTone(row.kind)}>{SESSION_CHANGE_LABELS[row.kind]}</Badge>
                      <code className="text-xs">{row.sessionId}</code>
                    </div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Before
                        </p>
                        <SessionSnapshot session={row.before} />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          After
                        </p>
                        <SessionSnapshot session={row.after} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {comparison.unchangedCount > 0 ? (
        <div className="text-sm">
          <Button size="sm" variant="ghost" onClick={() => setShowUnchangedNote((value) => !value)}>
            {showUnchangedNote ? 'Hide' : 'Show'} unchanged sessions
          </Button>
          {showUnchangedNote ? (
            <p className="mt-1 text-muted-foreground">
              {comparison.unchangedCount} session
              {comparison.unchangedCount === 1 ? '' : 's'} kept the same day, time, room and
              content in both versions.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export interface VersionComparisonProps {
  /** The logical schedule the versions belong to; enforced by the comparison. */
  scheduleId: number;
  versions: readonly ScheduleVersionSummary[];
  /** Preselected base version. */
  initialBaseId?: number | null;
  /** Preselected comparison version; defaults to the newest other version. */
  initialCompareId?: number | null;
}

/**
 * Compare two versions of one schedule.
 *
 * Both selectors are filled from a single schedule's history, so a version of one
 * department can never be compared against another department's. Those versions
 * describe unrelated sessions, and pairing them on `session_id` would report
 * nonsense.
 */
export function VersionComparison({
  scheduleId,
  versions,
  initialBaseId = null,
  initialCompareId = null,
}: VersionComparisonProps) {
  const [baseId, setBaseId] = React.useState<number | null>(initialBaseId);
  const [compareId, setCompareId] = React.useState<number | null>(initialCompareId);
  const [comparison, setComparison] = React.useState<TimetableComparison | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const orderedVersions = React.useMemo(
    () => [...versions].sort((left, right) => right.version_number - left.version_number),
    [versions],
  );

  const run = async () => {
    if (baseId === null || compareId === null) {
      setError('Select a base version and a comparison version.');
      return;
    }
    if (baseId === compareId) {
      setError('Select two different versions.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setComparison(null);
    try {
      const [baseEntries, compareEntries] = await Promise.all([
        scheduleVersionsApi.entries(baseId),
        scheduleVersionsApi.entries(compareId),
      ]);
      const base = sessionsFromEntries(baseEntries);
      const next = sessionsFromEntries(compareEntries);
      // Each side is compared against the same schedule, so the guard holds.
      setComparison(
        compareSessions(base, next, { scheduleA: scheduleId, scheduleB: scheduleId }),
      );
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  };

  if (orderedVersions.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        This schedule has {orderedVersions.length} stored version
        {orderedVersions.length === 1 ? '' : 's'}. Comparison needs two versions of the same
        schedule.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="text-sm">
          <label
            htmlFor="compare-base"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Base version
          </label>
          <select
            id="compare-base"
            className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-2 text-sm"
            value={baseId === null ? '' : String(baseId)}
            onChange={(event) => setBaseId(toNumberOrNull(event.target.value))}
          >
            <option value="">Select a version</option>
            {orderedVersions.map((version) => (
              <option key={version.id} value={version.id}>
                V{version.version_number} · {version.status} · {version.entry_count} sessions
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm">
          <label
            htmlFor="compare-target"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Comparison version
          </label>
          <select
            id="compare-target"
            className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-2 text-sm"
            value={compareId === null ? '' : String(compareId)}
            onChange={(event) => setCompareId(toNumberOrNull(event.target.value))}
          >
            <option value="">Select a version</option>
            {orderedVersions.map((version) => (
              <option key={version.id} value={version.id}>
                V{version.version_number} · {version.status} · {version.entry_count} sessions
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => void run()} isLoading={isLoading} disabled={isLoading}>
            Compare versions
          </Button>
        </div>
      </div>

      {error ? (
        <Alert tone="danger" title="Comparison could not run">
          {error}
        </Alert>
      ) : null}

      {comparison ? <ComparisonResult comparison={comparison} /> : null}
    </div>
  );
}

export interface VersionComparisonCardProps extends VersionComparisonProps {
  title?: string;
}

/** Card wrapper so the comparison can sit inside the schedule detail page. */
export function VersionComparisonCard({
  title = 'Compare versions',
  ...props
}: VersionComparisonCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <VersionComparison {...props} />
      </CardBody>
    </Card>
  );
}
