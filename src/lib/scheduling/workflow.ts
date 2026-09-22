/**
 * Schedule workflow model.
 *
 * The backend's state machine is tiny and strictly forward:
 *
 * ```
 * DRAFT → SUBMITTED → REVIEWED → APPROVED → PUBLISHED
 * ```
 *
 * Each transition is its own endpoint with an empty body. There is no generic
 * status editor, no backward transition and no client-side chaining: this module
 * only says which single action is available next, and for whom.
 */

import {
  PUBLISHED_STATUS,
  WORKFLOW_ACTION_LABELS,
  WORKFLOW_ACTION_VERBS,
  WORKFLOW_SOURCE_STATUS,
  WORKFLOW_TARGET_STATUS,
  WORKFLOW_REJECTION_HELP,
  WORKFLOW_REJECTION_LABELS,
} from '@/lib/scheduling/constants';
import type {
  ScheduleScope,
  ScheduleStatus,
  WorkflowAction,
  WorkflowRejectionReason,
} from '@/lib/scheduling/types';

/**
 * What a capability check needs to know about a version.
 *
 * Every field is optional: a caller that has not loaded the schedule yet must fail
 * closed rather than assume an action is allowed.
 */
export interface VersionWorkflowContext {
  /** Scope of the schedule the version belongs to. */
  scheduleScope?: ScheduleScope | null;
  /** Department of a department schedule; `null` for a college schedule. */
  scheduleDepartmentId?: number | null;
  status?: ScheduleStatus | null;
  /** True only when this is the newest version of its schedule. */
  isLatestVersion?: boolean | null;
}

/** The action that moves a version from its current status, if any. */
export function actionForStatus(status: ScheduleStatus | null | undefined): WorkflowAction | null {
  if (status === 'DRAFT') {
    return 'SUBMIT';
  }
  if (status === 'SUBMITTED') {
    return 'REVIEW';
  }
  if (status === 'REVIEWED') {
    return 'APPROVE';
  }
  if (status === 'APPROVED') {
    return 'PUBLISH';
  }
  return null;
}

/** The status a version lands in after an action. */
export function statusAfterAction(action: WorkflowAction): ScheduleStatus {
  return WORKFLOW_TARGET_STATUS[action];
}

/** True when the action may only be applied to this exact status. */
export function actionMatchesStatus(
  action: WorkflowAction,
  status: ScheduleStatus | null | undefined,
): boolean {
  return status === WORKFLOW_SOURCE_STATUS[action];
}

/** True when a version is part of the official timetable history. */
export function isPublishedStatus(status: ScheduleStatus | null | undefined): boolean {
  return status === PUBLISHED_STATUS;
}

/** Whether the publish control is structurally possible for this schedule. */
export function isPublishableScope(scope: ScheduleScope | null | undefined): boolean {
  return scope === 'COLLEGE';
}

export interface WorkflowConfirmation {
  title: string;
  /** States the schedule scope, semester, version number and action. */
  detail: string;
  confirmLabel: string;
}

export interface WorkflowConfirmationContext {
  action: WorkflowAction;
  versionNumber: number | null;
  scheduleScope: ScheduleScope | null | undefined;
  semesterLabel: string;
  departmentCode?: string | null;
}

/**
 * Confirmation copy for a transition.
 *
 * The text names the scope, the semester, the version and the action, so nobody
 * confirms an ambiguous "are you sure?".
 */
export function workflowConfirmation({
  action,
  versionNumber,
  scheduleScope,
  semesterLabel,
  departmentCode = null,
}: WorkflowConfirmationContext): WorkflowConfirmation {
  const scopeLabel =
    scheduleScope === 'COLLEGE'
      ? 'College-wide schedule'
      : `Department schedule${departmentCode ? ` (${departmentCode})` : ''}`;
  const versionLabel = versionNumber === null ? 'this version' : `V${versionNumber}`;

  const effect: Record<WorkflowAction, string> = {
    SUBMIT: 'The version becomes SUBMITTED so a college administrator can review it.',
    REVIEW: 'The version becomes REVIEWED so a college administrator can approve it.',
    APPROVE: 'The version becomes APPROVED.',
    PUBLISH:
      'The version becomes the official published timetable for this semester. Earlier published versions stay in the history and are not deleted, and the published-version pointer moves to this version.',
  };

  return {
    title: `${WORKFLOW_ACTION_LABELS[action]} — ${versionLabel}`,
    detail: `${scopeLabel} · ${semesterLabel} · ${versionLabel}. ${effect[action]}`,
    confirmLabel: WORKFLOW_ACTION_VERBS[action],
  };
}

export function formatWorkflowRejection(reason: WorkflowRejectionReason): string {
  return WORKFLOW_REJECTION_LABELS[reason] ?? reason;
}

export function describeWorkflowRejection(reason: WorkflowRejectionReason): string {
  return WORKFLOW_REJECTION_HELP[reason] ?? '';
}

/**
 * True when a refusal means the page is out of date rather than broken.
 *
 * The UI offers a refresh instead of retrying blindly: another editor or another
 * administrator moved the schedule on.
 */
export function isStaleRefusal(reason: WorkflowRejectionReason): boolean {
  return reason === 'STALE_VERSION' || reason === 'INVALID_TRANSITION';
}
