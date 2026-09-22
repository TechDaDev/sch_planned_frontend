/**
 * Academic capability helpers.
 *
 * These helpers mirror the accepted backend permission classes
 * (`academics/permissions.py`, `accounts/models.py`) so the UI only offers
 * actions the backend will actually authorize. They are a usability layer, never
 * an authorization layer: Django remains authoritative, and the UI still renders
 * whatever the backend rejects.
 *
 * Terminology matches the backend exactly:
 * - cross-department access: `COLLEGE_ADMIN` (or Django superuser) only;
 * - department-scoped management: `DEPARTMENT_ADMIN` acting on its own
 *   department;
 * - every other role is read-only and outside Academic Administration.
 */

import type { CurrentUser } from '@/lib/auth/types';
import { isUserRole, type UserRole } from '@/lib/roles';

/** The only user fields these helpers depend on. */
export interface AcademicCapabilityUser {
  role: UserRole;
  department: { id: number } | null;
}

export function toCapabilityUser(user: CurrentUser): AcademicCapabilityUser {
  return { role: user.role, department: user.department };
}

export function isCollegeAdmin(user: AcademicCapabilityUser | null): boolean {
  return user !== null && user.role === 'COLLEGE_ADMIN';
}

export function isDepartmentAdmin(user: AcademicCapabilityUser | null): boolean {
  return user !== null && user.role === 'DEPARTMENT_ADMIN';
}

/** The user's own department id, or `null` when none is assigned. */
export function ownDepartmentId(user: AcademicCapabilityUser | null): number | null {
  return user?.department?.id ?? null;
}

/** Equivalent of the backend's `has_cross_department_access`. */
export function hasCrossDepartmentAccess(user: AcademicCapabilityUser | null): boolean {
  return isCollegeAdmin(user);
}

/**
 * A department-scoped administrator with no department.
 *
 * Such an account manages nothing: the UI must fail closed instead of treating
 * it as a college administrator.
 */
export function isUnassignedDepartmentAdmin(user: AcademicCapabilityUser | null): boolean {
  return isDepartmentAdmin(user) && ownDepartmentId(user) === null;
}

/** Academic Administration is an administration workspace. */
export function canAccessAcademicModule(user: AcademicCapabilityUser | null): boolean {
  if (user === null) {
    return false;
  }
  return isCollegeAdmin(user) || isDepartmentAdmin(user);
}

/** Equivalent of the backend's `user_can_manage_department`. */
export function canManageDepartment(
  user: AcademicCapabilityUser | null,
  departmentId: number | null | undefined,
): boolean {
  if (user === null || departmentId === null || departmentId === undefined) {
    return false;
  }
  if (hasCrossDepartmentAccess(user)) {
    return true;
  }
  return isDepartmentAdmin(user) && ownDepartmentId(user) === departmentId;
}

// --- Per-entity capabilities ---------------------------------------------

/** Colleges are college-wide: only a college administrator may write them. */
export function canManageCollege(user: AcademicCapabilityUser | null): boolean {
  return hasCrossDepartmentAccess(user);
}

/** Academic years are college-wide (only college administrators write them). */
export function canManageAcademicYear(user: AcademicCapabilityUser | null): boolean {
  return hasCrossDepartmentAccess(user);
}

/** Semesters are college-wide (only college administrators write them). */
export function canManageSemester(user: AcademicCapabilityUser | null): boolean {
  return hasCrossDepartmentAccess(user);
}

/** Creating a department is reserved for college administrators. */
export function canCreateDepartment(user: AcademicCapabilityUser | null): boolean {
  return hasCrossDepartmentAccess(user);
}

/** A department administrator may only update its own department. */
export function canEditDepartment(
  user: AcademicCapabilityUser | null,
  departmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, departmentId);
}

/** Programs, stages, groups and courses are owned by one department. */
export function canManageDepartmentOwnedResource(
  user: AcademicCapabilityUser | null,
  departmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, departmentId);
}

/** Offerings are writable by the department that manages the delivery. */
export function canManageOffering(
  user: AcademicCapabilityUser | null,
  managingDepartmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, managingDepartmentId);
}

/** Components are writable by the offering's managing department only. */
export function canManageComponent(
  user: AcademicCapabilityUser | null,
  managingDepartmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, managingDepartmentId);
}

/**
 * A component/group link is writable only when both sides belong to the user's
 * department. Linking another department's students is a college-administrator
 * action (joint teaching).
 */
export function canManageComponentGroup(
  user: AcademicCapabilityUser | null,
  componentDepartmentId: number | null | undefined,
  groupDepartmentId: number | null | undefined,
): boolean {
  return (
    canManageDepartment(user, componentDepartmentId) &&
    canManageDepartment(user, groupDepartmentId)
  );
}

// --- Row annotations ------------------------------------------------------

export type RowAccessBadge =
  | 'read-only'
  | 'joint'
  | 'external-manager'
  | 'external-owner'
  | 'owned'
  | 'shared'
  | 'college-wide';

export const ROW_ACCESS_LABELS: Record<RowAccessBadge, string> = {
  'read-only': 'Read only',
  joint: 'Joint',
  'external-manager': 'External manager',
  'external-owner': 'External owner',
  owned: 'Owned',
  shared: 'Shared',
  'college-wide': 'College-wide',
};

export function rowAccessLabel(badge: RowAccessBadge): string {
  return ROW_ACCESS_LABELS[badge];
}

/**
 * Row annotation for a course visible to a department that does not own it.
 *
 * A department-scoped user only sees foreign courses when its own students are
 * taught through a joint offering, so the honest label is "Joint". College
 * administrators can manage everything they can see.
 */
export function courseRowBadge(
  user: AcademicCapabilityUser | null,
  departmentId: number,
): RowAccessBadge | null {
  if (canManageDepartmentOwnedResource(user, departmentId)) {
    return null;
  }
  return isDepartmentAdmin(user) ? 'joint' : 'read-only';
}

/** Row annotation for an offering managed by another department. */
export function offeringRowBadge(
  user: AcademicCapabilityUser | null,
  managingDepartmentId: number,
): RowAccessBadge | null {
  if (canManageOffering(user, managingDepartmentId)) {
    return null;
  }
  return isDepartmentAdmin(user) ? 'external-manager' : 'read-only';
}

/** Row annotation for a component of an offering managed elsewhere. */
export function componentRowBadge(
  user: AcademicCapabilityUser | null,
  managingDepartmentId: number,
): RowAccessBadge | null {
  if (canManageComponent(user, managingDepartmentId)) {
    return null;
  }
  return isDepartmentAdmin(user) ? 'external-manager' : 'read-only';
}

/** Row annotation for a component/group link. */
export function componentGroupRowBadge(
  user: AcademicCapabilityUser | null,
  componentDepartmentId: number | null | undefined,
  groupDepartmentId: number | null | undefined,
): RowAccessBadge | null {
  if (canManageComponentGroup(user, componentDepartmentId, groupDepartmentId)) {
    return null;
  }
  if (!isDepartmentAdmin(user)) {
    return 'read-only';
  }
  const own = ownDepartmentId(user);
  if (own === groupDepartmentId) {
    return 'external-manager';
  }
  return 'joint';
}

/** True when the value is a role this frontend understands. */
export function isKnownRole(value: unknown): value is UserRole {
  return isUserRole(value);
}
