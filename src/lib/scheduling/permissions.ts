/**
 * Scheduling capability helpers.
 *
 * These mirror the accepted backend rules (`scheduling/permissions.py`,
 * `accounts/models.py`) so the workspace only offers actions the backend
 * authorizes. They are a usability layer: Django remains authoritative and its
 * rejections are always displayed.
 *
 * Backend equivalences:
 * - `CanRunPreSchedulingValidation.allowed_roles` — `COLLEGE_ADMIN`,
 *   `DEPARTMENT_ADMIN`, `SCHEDULER`;
 * - `CanRunCollegeScheduleGeneration` — `user.has_cross_department_access`,
 *   meaning `COLLEGE_ADMIN`;
 * - `SCHEDULE_READ_ROLES` — the four roles above plus `VIEWER`;
 * - `resolve_validation_scope` — college administrators reach any department,
 *   department-scoped roles only their own, and a department-scoped account with
 *   no department fails closed.
 */

import type { AcademicCapabilityUser } from '@/lib/academic/permissions';
import {
  hasCrossDepartmentAccess,
  isCollegeAdmin,
  ownDepartmentId,
} from '@/lib/academic/permissions';
import {
  AUDIT_READ_ROLES,
  PUBLISHED_ANALYTICS_ROLES,
  REPORT_ROLES,
  SCHEDULE_EDIT_ROLES,
  SCHEDULE_WORKFLOW_ROLES,
  SEMESTER_PLAN_IMPORT_ROLES,
} from '@/lib/scheduling/constants';
import {
  isPublishableScope,
  actionForStatus,
  actionMatchesStatus,
  type VersionWorkflowContext,
} from '@/lib/scheduling/workflow';
import type { WorkflowAction } from '@/lib/scheduling/types';
import { isUserRole } from '@/lib/roles';

export type SchedulingCapabilityUser = AcademicCapabilityUser;

/** Every role the frontend understands; used for the published timetable. */
const ALL_ROLES: readonly string[] = [
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
  'VIEWER',
  'INSTRUCTOR',
];

// --- Role gates -----------------------------------------------------------

/** Validation and generation roles (`CanRunPreSchedulingValidation`). */
const OPERATIONAL_ROLES: readonly string[] = [
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
];

/** Persisted schedule read roles (`SCHEDULE_READ_ROLES`). */
const HISTORY_ROLES: readonly string[] = [
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
  'VIEWER',
];

function hasRole(
  user: SchedulingCapabilityUser | null,
  roles: readonly string[],
): boolean {
  return user !== null && isUserRole(user.role) && roles.includes(user.role);
}

/** True when the role may open the scheduling workspace at all. */
export function canAccessSchedulingWorkspace(
  user: SchedulingCapabilityUser | null,
): boolean {
  return hasRole(user, HISTORY_ROLES);
}

/**
 * A department-scoped role without a department.
 *
 * Such an account owns no scope: every department operation fails closed instead
 * of falling back to "all departments".
 */
export function isDepartmentlessScopedUser(
  user: SchedulingCapabilityUser | null,
): boolean {
  if (user === null || !isUserRole(user.role)) {
    return false;
  }
  if (user.role === 'COLLEGE_ADMIN') {
    return false;
  }
  return ownDepartmentId(user) === null;
}

/** True when the role may run readiness validation at all. */
export function canRunValidation(
  user: SchedulingCapabilityUser | null,
): boolean {
  return hasRole(user, OPERATIONAL_ROLES) && !isDepartmentlessScopedUser(user);
}

/** College-wide validation is a college-administrator action. */
export function canRunCollegeValidation(
  user: SchedulingCapabilityUser | null,
): boolean {
  return hasCrossDepartmentAccess(user) && hasRole(user, OPERATIONAL_ROLES);
}

/** A department-scoped role validates its own department only. */
export function canRunDepartmentValidation(
  user: SchedulingCapabilityUser | null,
  departmentId: number | null | undefined,
): boolean {
  if (!canRunValidation(user)) {
    return false;
  }
  if (hasCrossDepartmentAccess(user)) {
    return true;
  }
  return departmentId !== null && departmentId !== undefined
    ? ownDepartmentId(user) === departmentId
    : false;
}

/** Alias kept for the report's naming: readiness is the validation endpoint. */
export const canRunReadinessValidation = canRunValidation;

// --- Preview generation ---------------------------------------------------

/** Department preview: college administrators anywhere, scoped roles on their own. */
export function canGenerateDepartmentPreview(
  user: SchedulingCapabilityUser | null,
  departmentId: number | null | undefined,
): boolean {
  return canRunDepartmentValidation(user, departmentId);
}

/** College-wide preview: `COLLEGE_ADMIN` only. */
export function canGenerateCollegePreview(
  user: SchedulingCapabilityUser | null,
): boolean {
  return canRunCollegeValidation(user);
}

// --- Persisted drafts -----------------------------------------------------

/** Department draft generation follows the same scope rule as its preview. */
export function canPersistDepartmentDraft(
  user: SchedulingCapabilityUser | null,
  departmentId: number | null | undefined,
): boolean {
  return canRunDepartmentValidation(user, departmentId);
}

/** College draft generation: `COLLEGE_ADMIN` only. */
export function canPersistCollegeDraft(
  user: SchedulingCapabilityUser | null,
): boolean {
  return canRunCollegeValidation(user);
}

// --- History --------------------------------------------------------------

/** Reading persisted schedules, versions and entries. */
export function canReadScheduleHistory(
  user: SchedulingCapabilityUser | null,
): boolean {
  if (!hasRole(user, HISTORY_ROLES)) {
    return false;
  }
  return !isDepartmentlessScopedUser(user);
}

/** Version comparison uses the same read authority as the history itself. */
export function canCompareVersions(user: SchedulingCapabilityUser | null): boolean {
  return canReadScheduleHistory(user);
}

// --- Scope presentation helpers ------------------------------------------

/**
 * The department a scoped role is fixed to, or `null` when the user may choose.
 *
 * A department administrator or scheduler never gets a foreign department
 * selector: the workspace shows their own department as a fixed value.
 */
export function fixedDepartmentId(
  user: SchedulingCapabilityUser | null,
): number | null {
  if (hasCrossDepartmentAccess(user)) {
    return null;
  }
  return ownDepartmentId(user);
}

/** True when the user may pick any department for a department operation. */
export function canChooseAnyDepartment(
  user: SchedulingCapabilityUser | null,
): boolean {
  return hasCrossDepartmentAccess(user);
}

/** True for a college administrator, who alone sees college-wide actions. */
export function isCollegeScheduler(user: SchedulingCapabilityUser | null): boolean {
  return isCollegeAdmin(user);
}

// --- F4: schedule scoping -------------------------------------------------

/**
 * Whether a scoped role may act on one logical schedule.
 *
 * College administrators reach every schedule their backend role exposes. A
 * department-scoped role reaches its own department's drafts only, and never the
 * college-wide schedule, matching `visible_schedules_filter`. A read-only role
 * (viewer, instructor) or an account without a department owns no scope at all, so
 * it fails closed here rather than being filtered by each caller.
 */
export function canManageSchedule(
  user: SchedulingCapabilityUser | null,
  scheduleScope: 'COLLEGE' | 'DEPARTMENT' | null | undefined,
  scheduleDepartmentId: number | null | undefined,
): boolean {
  if (!hasRole(user, SCHEDULE_WORKFLOW_ROLES) || isDepartmentlessScopedUser(user)) {
    return false;
  }
  if (hasCrossDepartmentAccess(user)) {
    return true;
  }
  if (scheduleScope !== 'DEPARTMENT') {
    return false;
  }
  const own = ownDepartmentId(user);
  return own !== null && scheduleDepartmentId === own;
}

/** True when the role may propose and store a manual edit at all. */
export function canManualEditSchedule(user: SchedulingCapabilityUser | null): boolean {
  return hasRole(user, SCHEDULE_EDIT_ROLES) && !isDepartmentlessScopedUser(user);
}

/**
 * Whether the manual-edit page may be offered for one version.
 *
 * Editing needs a draft, the newest version, and a schedule in scope. Everything
 * unknown fails closed: the backend refuses a stale or non-draft base anyway.
 */
export function canManualEditVersion(
  user: SchedulingCapabilityUser | null,
  context: VersionWorkflowContext,
): boolean {
  if (!canManualEditSchedule(user)) {
    return false;
  }
  if (!canManageSchedule(user, context.scheduleScope, context.scheduleDepartmentId)) {
    return false;
  }
  return context.status === 'DRAFT' && context.isLatestVersion === true;
}

// --- F4: workflow capabilities -------------------------------------------

/** Submit: the newest DRAFT of a schedule in scope. */
export function canSubmitVersion(
  user: SchedulingCapabilityUser | null,
  context: VersionWorkflowContext,
): boolean {
  return canRunScheduleWorkflow(user) && canPerformAction(user, 'SUBMIT', context);
}

/**
 * Review: a college administrator, on a SUBMITTED version.
 *
 * A department administrator may not review its own submission, so the role gate
 * does the whole job here.
 */
export function canReviewVersion(
  user: SchedulingCapabilityUser | null,
  context: VersionWorkflowContext,
): boolean {
  return isCollegeAdmin(user) && canPerformAction(user, 'REVIEW', context);
}

/** Approve: a college administrator, on a REVIEWED version, either scope. */
export function canApproveVersion(
  user: SchedulingCapabilityUser | null,
  context: VersionWorkflowContext,
): boolean {
  return isCollegeAdmin(user) && canPerformAction(user, 'APPROVE', context);
}

/**
 * Publish: a college administrator, on an APPROVED **college** version.
 *
 * A department schedule may reach APPROVED and stops there.
 */
export function canPublishVersion(
  user: SchedulingCapabilityUser | null,
  context: VersionWorkflowContext,
): boolean {
  if (!isPublishableScope(context.scheduleScope)) {
    return false;
  }
  return isCollegeAdmin(user) && canPerformAction(user, 'PUBLISH', context);
}

/** True when the role may advance a workflow stage at all. */
export function canRunScheduleWorkflow(user: SchedulingCapabilityUser | null): boolean {
  return hasRole(user, SCHEDULE_WORKFLOW_ROLES) && !isDepartmentlessScopedUser(user);
}

function hasKnownStatus(context: VersionWorkflowContext): boolean {
  return typeof context.status === 'string' && context.status.length > 0;
}

/**
 * Whether one workflow action may be offered for a version.
 *
 * Deliberately conservative: an unknown status, scope or latest-state yields
 * `false`, so a half-loaded page never shows an action the backend would refuse.
 */
export function canPerformAction(
  user: SchedulingCapabilityUser | null,
  action: WorkflowAction,
  context: VersionWorkflowContext,
): boolean {
  if (!canRunScheduleWorkflow(user)) {
    return false;
  }
  if (!canManageSchedule(user, context.scheduleScope, context.scheduleDepartmentId)) {
    return false;
  }
  if (!hasKnownStatus(context) || !actionMatchesStatus(action, context.status)) {
    return false;
  }
  // Every action moves the newest version of its schedule; the backend refuses a
  // stale one outright, so the UI does not offer it.
  if (context.isLatestVersion !== true) {
    return false;
  }
  if (action === 'REVIEW' || action === 'APPROVE' || action === 'PUBLISH') {
    return isCollegeAdmin(user);
  }
  return true;
}

/**
 * The single action available to this user right now, or `null`.
 *
 * A version yields at most one action, because the state machine has exactly one
 * successor per status. Nothing is chained: after the call the page reloads and
 * offers the next one.
 */
export function availableWorkflowAction(
  user: SchedulingCapabilityUser | null,
  context: VersionWorkflowContext,
): WorkflowAction | null {
  const action = actionForStatus(context.status ?? null);
  if (action === null) {
    return null;
  }
  // A department schedule is approved inside the college but never published, so
  // the publish control is not offered for it even to a college administrator.
  if (action === 'PUBLISH' && !isPublishableScope(context.scheduleScope)) {
    return null;
  }
  return canPerformAction(user, action, context) ? action : null;
}

// --- F4: reports ----------------------------------------------------------

/** Version analytics follow the schedule-read roles. */
export function canViewVersionAnalytics(user: SchedulingCapabilityUser | null): boolean {
  return canReadScheduleHistory(user);
}

/** Published analytics: management and read roles, never an instructor. */
export function canViewPublishedAnalytics(user: SchedulingCapabilityUser | null): boolean {
  if (isDepartmentlessScopedUser(user)) {
    return false;
  }
  return hasRole(user, PUBLISHED_ANALYTICS_ROLES);
}

/** True when the role may open the reports workspace. */
export function canAccessReports(user: SchedulingCapabilityUser | null): boolean {
  return hasRole(user, REPORT_ROLES) && !isDepartmentlessScopedUser(user);
}

/** True when the role may download a stored-version export. */
export function canExportVersion(user: SchedulingCapabilityUser | null): boolean {
  return canReadScheduleHistory(user);
}

/** Published exports are refused to instructors. */
export function canExportPublished(user: SchedulingCapabilityUser | null): boolean {
  return canViewPublishedAnalytics(user);
}

/** The official timetable endpoint is reachable by every signed-in role. */
export function canViewPublishedTimetable(user: SchedulingCapabilityUser | null): boolean {
  return hasRole(user, ALL_ROLES);
}

/** Only an instructor sees the personal teaching timetable. */
export function canViewMyTimetable(user: SchedulingCapabilityUser | null): boolean {
  return user !== null && user.role === 'INSTRUCTOR';
}

// --- F4: imports ----------------------------------------------------------

/** Import roles: college and department administrators only. */
export function canImportSemesterPlan(user: SchedulingCapabilityUser | null): boolean {
  return hasRole(user, SEMESTER_PLAN_IMPORT_ROLES) && !isDepartmentlessScopedUser(user);
}

/**
 * The department an import may target.
 *
 * A scoped administrator is fixed to its own department; a college administrator
 * chooses. A department-scoped account with no department is refused outright,
 * matching `resolve_import_department`.
 */
export function importDepartmentScope(
  user: SchedulingCapabilityUser | null,
): { fixed: number | null; mayChoose: boolean } {
  if (!canImportSemesterPlan(user)) {
    return { fixed: null, mayChoose: false };
  }
  if (hasCrossDepartmentAccess(user)) {
    return { fixed: null, mayChoose: true };
  }
  return { fixed: ownDepartmentId(user), mayChoose: false };
}

// --- F4: audit ------------------------------------------------------------

/** Audit read roles: college and department administrators only. */
export function canViewAudit(user: SchedulingCapabilityUser | null): boolean {
  return hasRole(user, AUDIT_READ_ROLES) && !isDepartmentlessScopedUser(user);
}
