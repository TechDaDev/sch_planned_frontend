'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import {
  describeSolverStatus,
  formatCount,
  formatSeconds,
  formatSolverStatus,
} from '@/lib/scheduling/formatters';
import type {
  CollegeGenerationDiagnostics,
  CollegeGenerationSummary,
  GenerationDiagnostics,
  GenerationSummary,
} from '@/lib/scheduling/types';

function StatusTone(status: string): 'success' | 'info' | 'warning' | 'danger' {
  if (status === 'OPTIMAL') {
    return 'success';
  }
  if (status === 'FEASIBLE') {
    return 'info';
  }
  if (status === 'INFEASIBLE') {
    return 'warning';
  }
  return 'danger';
}

/**
 * Solver metadata as the UI consumes it.
 *
 * `status` is typed as `string` because a persisted version stores it as free
 * text; an unknown value is shown verbatim instead of being coerced.
 */
export interface SolverReportLike {
  status: string;
  objective_value?: number | null;
  wall_time_seconds?: number | null;
  num_conflicts?: number | null;
  num_branches?: number | null;
  message?: string;
}

export interface SolverReportViewProps {
  solver: SolverReportLike | null | undefined;
  /** Rendered when no solver ran, e.g. because generation was refused early. */
  fallbackMessage?: string;
}

/**
 * What the CP-SAT engine reported.
 *
 * `FEASIBLE` keeps its own label and explanation: a valid timetable found without
 * a proof of optimality is never presented as `OPTIMAL`. Percentages are never
 * invented, because the backend reports none.
 */
export function SolverReportView({ solver, fallbackMessage }: SolverReportViewProps) {
  if (!solver) {
    return (
      <p className="text-sm text-muted-foreground">
        {fallbackMessage ?? 'No solver run was recorded for this outcome.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={StatusTone(solver.status)}>{formatSolverStatus(solver.status)}</Badge>
        {solver.objective_value === null || solver.objective_value === undefined ? null : (
          <span className="text-xs text-muted-foreground">
            Objective value {solver.objective_value}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{describeSolverStatus(solver.status)}</p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Wall time</dt>
          <dd>{formatSeconds(solver.wall_time_seconds)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Conflicts</dt>
          <dd>{formatCount(solver.num_conflicts)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Branches</dt>
          <dd>{formatCount(solver.num_branches)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Objective value
          </dt>
          <dd>{formatCount(solver.objective_value ?? null)}</dd>
        </div>
      </dl>
      {solver.message ? (
        <p className="text-xs text-muted-foreground">{solver.message}</p>
      ) : null}
    </div>
  );
}

export interface GenerationSummaryViewProps {
  summary: GenerationSummary | CollegeGenerationSummary | null | undefined;
}

function isCollegeSummary(
  summary: GenerationSummary | CollegeGenerationSummary,
): summary is CollegeGenerationSummary {
  return 'departments' in summary;
}

/** Factual counts of what was built and placed. */
export function GenerationSummaryView({ summary }: GenerationSummaryViewProps) {
  if (!summary) {
    return (
      <p className="text-sm text-muted-foreground">
        No generation summary was returned.
      </p>
    );
  }

  const entries: { label: string; value: number }[] = [];
  if (isCollegeSummary(summary)) {
    entries.push({ label: 'Departments', value: summary.departments });
  }
  entries.push(
    { label: 'Components', value: summary.components },
    { label: 'Sessions', value: summary.sessions },
    { label: 'Candidates', value: summary.candidates },
    { label: 'Placements', value: summary.placements },
  );

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
      {entries.map((entry) => (
        <div key={entry.label}>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {entry.label}
          </dt>
          <dd>{formatCount(entry.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function isCollegeDiagnostics(
  diagnostics: GenerationDiagnostics | CollegeGenerationDiagnostics,
): diagnostics is CollegeGenerationDiagnostics {
  return 'department_breakdown' in diagnostics;
}

/**
 * Candidate diagnostics.
 *
 * These numbers describe what the builder produced. They are diagnostics, not a
 * root cause: the solver proves that no timetable exists, not why, and the panel
 * says so.
 */
export function GenerationDiagnosticsView({
  diagnostics,
}: {
  diagnostics: GenerationDiagnostics | CollegeGenerationDiagnostics | null | undefined;
}) {
  if (!diagnostics) {
    return null;
  }

  const withoutCandidates = diagnostics.sessions_without_candidates ?? [];

  return (
    <details className="rounded-md border border-line px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">
        Diagnostics
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          Diagnostics describe what the candidate builder produced. They do not prove the
          exact cause of an infeasible timetable.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Components</dt>
            <dd>{formatCount(diagnostics.components)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Sessions</dt>
            <dd>{formatCount(diagnostics.sessions)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Candidates</dt>
            <dd>{formatCount(diagnostics.candidates)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Candidates per session
            </dt>
            <dd>
              {formatCount(diagnostics.min_candidates_per_session)}–
              {formatCount(diagnostics.max_candidates_per_session)}
            </dd>
          </div>
        </dl>

        {isCollegeDiagnostics(diagnostics) ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <caption className="sr-only">
                Per-managing-department candidate build counts
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                    Department
                  </th>
                  <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                    Components
                  </th>
                  <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                    Sessions
                  </th>
                  <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                    Candidates
                  </th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.department_breakdown.map((row) => (
                  <tr key={row.department.id} className="border-b border-line last:border-0">
                    <td className="px-2 py-1">{row.department.code}</td>
                    <td className="px-2 py-1">{row.components}</td>
                    <td className="px-2 py-1">{row.sessions}</td>
                    <td className="px-2 py-1">{row.candidates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {diagnostics.sessions_with_fewest_candidates.length > 0 ? (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
              Sessions with fewest candidates
            </h3>
            <ul className="mt-1 list-disc pl-5">
              {diagnostics.sessions_with_fewest_candidates.map((entry) => (
                <li key={entry.session_id}>
                  <code className="text-xs">{entry.session_id}</code> — {entry.candidate_count}{' '}
                  candidate{entry.candidate_count === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {withoutCandidates.length > 0 ? (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
              Sessions without candidates
            </h3>
            <ul className="mt-1 list-disc pl-5">
              {withoutCandidates.map((sessionId) => (
                <li key={sessionId}>
                  <code className="text-xs">{sessionId}</code>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export interface DepartmentSummariesViewProps {
  summaries: readonly {
    department: { id: number; code: string; name: string };
    components: number;
    sessions: number;
    candidates: number;
    placements: number;
  }[];
}

/** Per-managing-department share of a college-wide run. */
export function DepartmentSummariesView({ summaries }: DepartmentSummariesViewProps) {
  if (summaries.length === 0) {
    return null;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Placements per managing department</CardTitle>
      </CardHeader>
      <CardBody className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">College-wide generation summary by department</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                Department
              </th>
              <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                Components
              </th>
              <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                Sessions
              </th>
              <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                Candidates
              </th>
              <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                Placements
              </th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((row) => (
              <tr key={row.department.id} className="border-b border-line last:border-0">
                <td className="px-2 py-1">
                  {row.department.code} — {row.department.name}
                </td>
                <td className="px-2 py-1">{row.components}</td>
                <td className="px-2 py-1">{row.sessions}</td>
                <td className="px-2 py-1">{row.candidates}</td>
                <td className="px-2 py-1">{row.placements}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
