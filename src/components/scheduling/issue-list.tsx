'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { IssueDetails } from '@/lib/scheduling/types';
import { cn } from '@/lib/utils/cn';

/**
 * One issue as every scheduling surface reports it.
 *
 * Manual-edit issues, workflow issues and import issues share this shape: a stable
 * code, a message, and optional rows, positions or structured details. The code is
 * always shown, because it is what an operator quotes when asking for help.
 */
export interface IssueRow {
  code: string;
  message: string;
  /** `ERROR` blocks; `WARNING` never does. Manual-edit issues have no severity. */
  severity?: string;
  /** Persisted entry the issue is about. */
  entryId?: number | null;
  /** Other persisted entry the issue collides with. */
  conflictingEntryId?: number | null;
  /** Spreadsheet position, for import issues. */
  location?: string | null;
  details?: IssueDetails;
}

export type IssueFilter = 'ALL' | 'ERROR' | 'WARNING';

const FILTERS: readonly { value: IssueFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ERROR', label: 'Errors' },
  { value: 'WARNING', label: 'Warnings' },
];

function renderDetailValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return <span className="break-words">{String(value)}</span>;
  }
  if (typeof value === 'boolean') {
    return <span>{value ? 'true' : 'false'}</span>;
  }
  if (Array.isArray(value)) {
    const primitives = value.filter(
      (entry) =>
        entry === null ||
        typeof entry === 'string' ||
        typeof entry === 'number' ||
        typeof entry === 'boolean',
    );
    if (primitives.length === value.length && value.length > 0) {
      return <span className="break-words">{primitives.map(String).join(', ')}</span>;
    }
    return (
      <span className="text-muted-foreground">
        {value.length} structured {value.length === 1 ? 'entry' : 'entries'}
      </span>
    );
  }
  return <span className="text-muted-foreground">Structured value</span>;
}

function DetailsView({ details }: { details: IssueDetails }) {
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return null;
  }
  return (
    <dl className="mt-1 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[minmax(8rem,auto)_1fr]">
      {entries.map(([key, value]) => (
        <React.Fragment key={key}>
          <dt className="font-medium text-muted-foreground">{key}</dt>
          <dd>{renderDetailValue(value)}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export interface IssueListProps {
  issues: readonly IssueRow[];
  /** Show the Errors/Warnings/All switch. Off for lists without severities. */
  filterable?: boolean;
  emptyMessage?: string;
  className?: string;
  label?: string;
}

/**
 * Issue list for a manual-edit proposal, a workflow validation or an import.
 *
 * Conflict information is never flattened: the offending entry and the entry it
 * collides with stay visible, because that pair is what a scheduler has to resolve.
 */
export function IssueList({
  issues,
  filterable = true,
  emptyMessage = 'No issue was reported.',
  className,
  label = 'Issues',
}: IssueListProps) {
  const [filter, setFilter] = React.useState<IssueFilter>('ALL');

  const hasSeverities = issues.some((issue) => typeof issue.severity === 'string');
  const errorCount = issues.filter((issue) => issue.severity === 'ERROR').length;
  const warningCount = issues.filter((issue) => issue.severity === 'WARNING').length;

  const visible =
    filterable && hasSeverities
      ? issues.filter((issue) => filter === 'ALL' || issue.severity === filter)
      : issues;

  return (
    <section className={cn('space-y-3', className)} aria-label={label}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {issues.length} issue{issues.length === 1 ? '' : 's'}
          {hasSeverities ? ` (${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'})` : ''}
        </span>
        {filterable && hasSeverities ? (
          <div role="group" aria-label="Filter issues by severity" className="flex gap-1">
            {FILTERS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={filter === option.value ? 'secondary' : 'ghost'}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {issues.length === 0 ? emptyMessage : 'No issue matches the selected filter.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((issue, index) => (
            <li
              key={`${issue.code}-${issue.entryId ?? issue.location ?? 'none'}-${index}`}
              className="rounded-md border border-line px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                {issue.severity ? (
                  <Badge tone={issue.severity === 'ERROR' ? 'danger' : 'warning'}>
                    {issue.severity === 'ERROR' ? 'Error' : 'Warning'}
                  </Badge>
                ) : null}
                <code className="text-xs">{issue.code}</code>
                {issue.entryId !== null && issue.entryId !== undefined ? (
                  <span className="text-xs text-muted-foreground">
                    Entry #{issue.entryId}
                  </span>
                ) : null}
                {issue.conflictingEntryId !== null &&
                issue.conflictingEntryId !== undefined ? (
                  <span className="text-xs text-muted-foreground">
                    Conflicts with entry #{issue.conflictingEntryId}
                  </span>
                ) : null}
                {issue.location ? (
                  <span className="text-xs text-muted-foreground">{issue.location}</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm">{issue.message}</p>
              {issue.details ? <DetailsView details={issue.details} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
