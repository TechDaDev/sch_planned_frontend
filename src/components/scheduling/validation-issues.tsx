'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatSeverity } from '@/lib/scheduling/formatters';
import type { IssueDetails, ValidationIssue } from '@/lib/scheduling/types';
import { cn } from '@/lib/utils/cn';

export type IssueFilter = 'ALL' | 'ERROR' | 'WARNING';

export const ISSUE_FILTER_OPTIONS: readonly { value: IssueFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ERROR', label: 'Errors' },
  { value: 'WARNING', label: 'Warnings' },
];

/**
 * Render one value of an issue's structured `details`.
 *
 * Only primitives are rendered as text. Anything else is described generically,
 * so backend data can never become markup and a nested object never breaks the
 * page.
 */
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

function IssueDetailsView({ details }: { details: IssueDetails }) {
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

export interface ValidationIssuesProps {
  issues: readonly ValidationIssue[];
  /** Rendered above the list, for example a readiness or refusal headline. */
  heading?: React.ReactNode;
  emptyMessage?: string;
  className?: string;
  /** Start the list collapsed when there are no blocking issues. */
  defaultFilter?: IssueFilter;
}

/**
 * Validation and generation issues.
 *
 * Issue codes are always shown: they are what an operator quotes when asking for
 * help, so hiding them would make the panel less useful.
 */
export function ValidationIssues({
  issues,
  heading,
  emptyMessage = 'No issues were reported.',
  className,
  defaultFilter = 'ALL',
}: ValidationIssuesProps) {
  const [filter, setFilter] = React.useState<IssueFilter>(defaultFilter);

  const errorCount = issues.filter((issue) => issue.severity === 'ERROR').length;
  const warningCount = issues.filter((issue) => issue.severity === 'WARNING').length;

  const visible = issues.filter(
    (issue) => filter === 'ALL' || issue.severity === filter,
  );

  return (
    <section className={cn('space-y-3', className)} aria-label="Validation issues">
      {heading}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {issues.length} issue{issues.length === 1 ? '' : 's'} ({errorCount} error
          {errorCount === 1 ? '' : 's'}, {warningCount} warning
          {warningCount === 1 ? '' : 's'})
        </span>
        <div role="group" aria-label="Filter issues by severity" className="flex gap-1">
          {ISSUE_FILTER_OPTIONS.map((option) => (
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
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {issues.length === 0 ? emptyMessage : 'No issues match the selected filter.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((issue, index) => (
            <li
              key={`${issue.code}-${issue.entity_type}-${issue.entity_id ?? 'none'}-${index}`}
              className="rounded-md border border-line px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={issue.severity === 'ERROR' ? 'danger' : 'warning'}>
                  {formatSeverity(issue.severity)}
                </Badge>
                <code className="text-xs">{issue.code}</code>
                <span className="text-xs text-muted-foreground">
                  {issue.entity_type}
                  {issue.entity_id === null || issue.entity_id === undefined
                    ? ''
                    : ` #${issue.entity_id}`}
                </span>
              </div>
              <p className="mt-1 text-sm">{issue.message}</p>
              {issue.details ? <IssueDetailsView details={issue.details} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
