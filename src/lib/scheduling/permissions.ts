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
import { isUserRole } from '@/lib/roles';

export type SchedulingCapabilityUser = AcademicCapabilityUser;

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
