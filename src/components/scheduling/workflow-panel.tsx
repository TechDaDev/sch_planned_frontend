'use client';

import Link from 'next/link';
import * as React from 'react';

import { ConfirmDialog } from '@/components/academic/confirm-dialog';
import { IssueList, type IssueRow } from '@/components/scheduling/issue-list';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage, ApiClientError } from '@/lib/api/errors';
import { workflowApi } from '@/lib/scheduling/api';
import {
  PUBLICATION_POINTER_NOTICE,
  SCHEDULING_ROUTES,
  WORKFLOW_ACTION_LABELS,
  WORKFLOW_VALIDATION_CURRENT_CONFIG_NOTICE,
} from '@/lib/scheduling/constants';
import {
  formatScheduleStatus,
  scheduleStatusTone,
} from '@/lib/scheduling/formatters';
import { useResource } from '@/lib/scheduling/use-resource';
import {
  describeWorkflowRejection,
  formatWorkflowRejection,
  isStaleRefusal,
  workflowConfirmation,
} from '@/lib/scheduling/workflow';
import type {
  ScheduleScope,
  ScheduleStatus,
  WorkflowAction,
  WorkflowRejectedResult,
  WorkflowValidationResult,
} from '@/lib/scheduling/types';
import { cn } from '@/lib/utils/cn';

function asWorkflowRejection(value: unknown): WorkflowRejectedResult | null {
  return value !== null && typeof value === 'object' && typeof (value as { reason?: unknown }).reason === 'string'
    ? (value as WorkflowRejectedResult)
    : null;
}

function toIssueRows(validation: WorkflowValidationResult | null | undefined): IssueRow[] {
  return (validation?.issues ?? []).map((issue) => ({
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    entryId: issue.entry_id ?? null,
    conflictingEntryId: issue.conflicting_entry_id ?? null,
    details: issue.details,
  }));
}

export interface WorkflowPanelProps {
  versionId: number;
  status: ScheduleStatus;
  versionNumber: number | null;
  scheduleScope: ScheduleScope | null | undefined;
  departmentCode?: string | null;
  semesterLabel: string;
  isLatestVersion: boolean;
  /** The single action the caller may take, decided by the capability helpers. */
  action: WorkflowAction | null;
  /** Whether publishing is structurally possible for this schedule. */
  publishableScope: boolean;
  /** Called after a successful transition so the page can reload its data. */
  onTransitioned: (result: { status: ScheduleStatus }) => void;
  className?: string;
}

/**
 * Workflow panel for one stored version.
 *
 * The state machine is forward-only and each action is its own separately confirmed
 * request: there is no combined "submit, review, approve and publish" control, and no
 * generic status editor. Every transition is confirmed with text naming the scope,
 * semester, version and action.
 */
export function WorkflowPanel({
  versionId,
  status,
  versionNumber,
  scheduleScope,
  departmentCode = null,
  semesterLabel,
  isLatestVersion,
  action,
  publishableScope,
  onTransitioned,
  className,
}: WorkflowPanelProps) {
  const [confirming, setConfirming] = React.useState<WorkflowAction | null>(null);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [rejection, setRejection] = React.useState<WorkflowRejectedResult | null>(null);
  const [applyError, setApplyError] = React.useState<string | null>(null);

  const loadValidation = React.useCallback(
    (signal: AbortSignal) => workflowApi.validation(versionId, signal),
    [versionId],
  );
  const validationResource = useResource<WorkflowValidationResult>(loadValidation);
  const validation = validationResource.data;
  const validationError = validationResource.error?.detail ?? null;
  const isValidating = validationResource.status === 'loading';

  /**
   * A transition is offered only once the workflow validation has confirmed that this
   * stored version can still advance.
   *
   * The question is answered by a second request, and the backend refuses to move a
   * version whose stored timetable no longer passes validation against today's
   * configuration. Offering the action while that answer is still unknown, failed or
   * negative would only produce a refusal the page already has the means to see, so
   * the control stays disabled and the reason is stated instead.
   */
  const validationBlocks = validation !== null && validation.valid !== true;
  const mayAdvance = validation !== null && validation.valid === true;
  const actionDisabled = isTransitioning || !mayAdvance;

  const runAction = async (chosen: WorkflowAction) => {
    if (!mayAdvance) {
      setConfirming(null);
      setApplyError(
        'The stored version does not pass workflow validation against today’s configuration, so no action was sent.',
      );
      return;
    }
    setIsTransitioning(true);
    setApplyError(null);
    setRejection(null);
    try {
      const result = await workflowApi.action(versionId, chosen);
      setConfirming(null);
      onTransitioned({ status: result.status });
    } catch (cause) {
      setConfirming(null);
      if (cause instanceof ApiClientError && cause.status === 409) {
        const body = asWorkflowRejection(cause.payload);
        if (body) {
          setRejection(body);
          return;
        }
      }
      setApplyError(getApiErrorMessage(cause));
    } finally {
      setIsTransitioning(false);
    }
  };

  const confirmation =
    confirming === null
      ? null
      : workflowConfirmation({
          action: confirming,
          versionNumber,
          scheduleScope,
          semesterLabel,
          departmentCode,
        });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Workflow</CardTitle>
        <CardDescription>
          Versions move forward one explicit stage at a time. There is no backward
          transition and no combined action.
        </CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Current stage
          </span>
          <Badge tone={scheduleStatusTone(status)}>{formatScheduleStatus(status)}</Badge>
          {versionNumber === null ? null : (
            <span className="text-xs text-muted-foreground">Version V{versionNumber}</span>
          )}
          {!isLatestVersion ? (
            <Badge tone="warning">Not the newest version</Badge>
          ) : null}
        </div>

        {!publishableScope ? (
          <Alert tone="info" title="Department schedule">
            A department schedule can be approved inside the college, but it never becomes
            the official timetable, so no publish action is offered for it.
          </Alert>
        ) : null}

        {!isLatestVersion ? (
          <Alert tone="warning" title="Only the newest version moves through the workflow">
            <p>
              This version is not the schedule’s newest one, so no transition is offered
              here.
            </p>
            <Link className="mt-1 inline-block underline" href={SCHEDULING_ROUTES.schedules}>
              Open schedule history
            </Link>
          </Alert>
        ) : action === null ? (
          <p className="text-sm text-muted-foreground">
            No workflow action is available for your role in this state.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setConfirming(action)} disabled={actionDisabled}>
              {WORKFLOW_ACTION_LABELS[action]}
            </Button>
            {isValidating ? (
              <span className="text-xs text-muted-foreground">
                Checking whether this stored version can still advance…
              </span>
            ) : mayAdvance ? (
              <span className="text-xs text-muted-foreground">
                You will confirm this action before it is sent.
              </span>
            ) : (
              <span className="text-xs text-danger">
                {validationBlocks
                  ? 'This action is not offered: the stored version does not pass validation against today’s configuration, so the backend would refuse it. Fix the blocking errors, or re-run the validation once the configuration has been corrected.'
                  : 'This action is not offered: the workflow validation could not run, so it is not known whether the stored version can still advance. Re-run the validation to check again.'}
              </span>
            )}
          </div>
        )}

        {applyError ? (
          <Alert tone="danger" title="The action could not be sent">
            {applyError}
          </Alert>
        ) : null}

        {rejection ? (
          <Alert
            tone="danger"
            title={formatWorkflowRejection(rejection.reason)}
          >
            <p>{rejection.message || describeWorkflowRejection(rejection.reason)}</p>
            <p className="mt-1 text-xs">
              <code>{rejection.reason}</code>
            </p>
            {isStaleRefusal(rejection.reason) ? (
              <p className="mt-1 text-xs">
                Nothing was changed. Refresh this page before acting again.
              </p>
            ) : null}
            {rejection.validation ? (
              <div className="mt-3">
                <IssueList
                  issues={toIssueRows(rejection.validation)}
                  label="Workflow validation issues"
                />
              </div>
            ) : null}
          </Alert>
        ) : null}

        <Alert tone="info" title="Publication pointer">
          {PUBLICATION_POINTER_NOTICE}
        </Alert>

        <div className="space-y-3 rounded-md border border-line px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Workflow validation</h3>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => validationResource.reload()}
              isLoading={isValidating}
            >
              Re-run validation
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{WORKFLOW_VALIDATION_CURRENT_CONFIG_NOTICE}</p>

          {validationError ? (
            <Alert tone="danger" title="Validation could not run">
              {validationError}
            </Alert>
          ) : null}

          {validation ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={validation.valid ? 'success' : 'danger'}>
                  {validation.valid ? 'Can advance' : 'Blocked'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {validation.summary.entries} entr
                  {validation.summary.entries === 1 ? 'y' : 'ies'} checked ·{' '}
                  {validation.summary.errors} blocking error
                  {validation.summary.errors === 1 ? '' : 's'}
                </span>
              </div>
              <IssueList
                issues={toIssueRows(validation)}
                label="Workflow validation issues"
                emptyMessage="No blocking issue was reported against today’s configuration."
              />
            </div>
          ) : null}
        </div>
      </CardBody>

      <ConfirmDialog
        open={confirming !== null}
        title={confirmation?.title ?? 'Confirm action'}
        description={confirmation?.detail ?? ''}
        confirmLabel={confirmation?.confirmLabel ?? 'Confirm'}
        isBusy={isTransitioning}
        onConfirm={() => {
          if (confirming) {
            void runAction(confirming);
          }
        }}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  );
}

export { toIssueRows };

/** Small status pill used by history rows and report headers. */
export function StatusBadge({
  status,
  className,
}: {
  status: ScheduleStatus | null | undefined;
  className?: string;
}) {
  return (
    <Badge tone={scheduleStatusTone(status)} className={cn(className)}>
      {formatScheduleStatus(status)}
    </Badge>
  );
}
