'use client';

import * as React from 'react';

import { GenerationDiagnosticsView } from '@/components/scheduling/generation-report';
import { ValidationIssues } from '@/components/scheduling/validation-issues';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { GenerationFailure } from '@/lib/scheduling/outcome';
import { PREVIEW_ONLY_MESSAGE } from '@/lib/scheduling/constants';
import type {
  CollegeGenerationDiagnostics,
  GenerationDiagnostics,
} from '@/lib/scheduling/types';

export interface GenerationFailureViewProps {
  failure: GenerationFailure;
  diagnostics?: GenerationDiagnostics | CollegeGenerationDiagnostics | null;
}

/** Tone of a failure headline, chosen from the classified outcome kind. */
function failureTone(kind: GenerationFailure['kind']): 'warning' | 'danger' | 'info' {
  if (kind === 'no-timetable' || kind === 'not-ready' || kind === 'no-candidates') {
    return 'warning';
  }
  if (kind === 'invalid-request' || kind === 'permission-denied') {
    return 'danger';
  }
  return 'info';
}

/**
 * One generation failure, stated in the terms the backend used.
 *
 * "Configuration not ready", "no placement candidates", "the solver could not
 * produce a timetable", "the request was invalid" and "permission denied" are
 * five different situations and are never flattened into "generation failed".
 */
export function GenerationFailureView({ failure, diagnostics }: GenerationFailureViewProps) {
  return (
    <div className="space-y-4">
      <Alert tone={failureTone(failure.kind)} title={failure.title}>
        <p>{failure.description}</p>
        {failure.reason ? (
          <p className="mt-1">
            <code className="text-xs">{failure.reason}</code>
          </p>
        ) : null}
        {failure.detail && failure.detail !== failure.description ? (
          <p className="mt-1 text-xs text-muted-foreground">{failure.detail}</p>
        ) : null}
      </Alert>

      {failure.fieldErrors ? (
        <div className="rounded-md border border-line px-4 py-3">
          <h3 className="text-sm font-medium">Rejected fields</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(failure.fieldErrors).map(([field, messages]) => (
              <li key={field}>
                <code className="text-xs">{field}</code>: {messages.join(' ')}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {failure.validation ? (
        <ValidationIssues
          issues={failure.validation.issues}
          heading={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={failure.validation.ready ? 'success' : 'danger'}>
                {failure.validation.ready ? 'Ready' : 'Not ready'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {failure.validation.summary.components_checked} component
                {failure.validation.summary.components_checked === 1 ? '' : 's'} checked
              </span>
            </div>
          }
        />
      ) : null}

      {failure.generationIssues.length > 0 ? (
        <ValidationIssues issues={failure.generationIssues} heading={<h3 className="text-sm font-medium">Generation issues</h3>} />
      ) : null}

      <GenerationDiagnosticsView diagnostics={diagnostics ?? null} />
    </div>
  );
}

export interface PreviewNoticeProps {
  className?: string;
}

/** States plainly that a preview stores nothing. */
export function PreviewNotice({ className }: PreviewNoticeProps) {
  return (
    <Alert tone="info" className={className} title="Preview only">
      {PREVIEW_ONLY_MESSAGE}
    </Alert>
  );
}
