/**
 * Resource capability helpers.
 *
 * These mirror the accepted backend rules (`resources/permissions.py`,
 * `scheduling/permissions.py`, `accounts/models.py`) so the UI only offers
 * actions the backend authorizes. They are a usability layer: Django remains
 * authoritative and its rejections are always displayed.
 *
 * Role semantics (cross-department access, department-scoped management) are the
 * same as academic administration, so they come from the single F1 source of
 * truth instead of being redefined here.
 */

import type { CurrentUser } from '@/lib/auth/types';
import type { AcademicCapabilityUser } from '@/lib/academic/permissions';
import {
  canManageDepartment,
  hasCrossDepartmentAccess,
  isCollegeAdmin,
  isDepartmentAdmin,
  isUnassignedDepartmentAdmin,
  ownDepartmentId,
  type RowAccessBadge,
} from '@/lib/academic/permissions';
import type { ExceptionScope, SharingScope } from '@/lib/resources/types';
import { isUserRole } from '@/lib/roles';

export type ResourceCapabilityUser = AcademicCapabilityUser;

export function toResourceCapabilityUser(user: CurrentUser): ResourceCapabilityUser {
  return { role: user.role, department: user.department };
}

export {
  canManageDepartment,
  hasCrossDepartmentAccess,
  isCollegeAdmin,
  isDepartmentAdmin,
  isUnassignedDepartmentAdmin,
  ownDepartmentId,
};

/** Resources are readable by administrators and by the scheduler role. */
export function canAccessResourcesModule(user: ResourceCapabilityUser | null): boolean {
  if (user === null || !isUserRole(user.role)) {
    return false;
  }
  return (
    isCollegeAdmin(user) ||
    isDepartmentAdmin(user) ||
    user.role === 'SCHEDULER'
  );
}

/**
 * Mutations are limited to administrators.
 *
 * A scheduler reads the resource workspace to prepare scheduling; it never
 * changes resource data.
 */
export function canManageResources(user: ResourceCapabilityUser | null): boolean {
  if (user === null) {
    return false;
  }
  return isCollegeAdmin(user) || isDepartmentAdmin(user);
}

export function isSchedulerReadOnly(user: ResourceCapabilityUser | null): boolean {
  return user !== null && user.role === 'SCHEDULER';
}

/** College-wide vocabulary (room types, room capabilities). */
export function canManageVocabulary(user: ResourceCapabilityUser | null): boolean {
  return hasCrossDepartmentAccess(user);
}

/** College-wide time grid (working days, time slots, break periods). */
export function canManageCalendarGrid(user: ResourceCapabilityUser | null): boolean {
  return hasCrossDepartmentAccess(user);
}

// --- Instructors ----------------------------------------------------------

/** Instructor profiles, sharing grants and windows: owning department only. */
export function canManageInstructor(
  user: ResourceCapabilityUser | null,
  primaryDepartmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, primaryDepartmentId);
}

export function canManageInstructorSharing(
  user: ResourceCapabilityUser | null,
  primaryDepartmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, primaryDepartmentId);
}

export function canManageInstructorWindows(
  user: ResourceCapabilityUser | null,
  primaryDepartmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, primaryDepartmentId);
}

/** Assignments are written by the department managing the component's offering. */
export function canManageTeachingAssignment(
  user: ResourceCapabilityUser | null,
  componentManagingDepartmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, componentManagingDepartmentId);
}

// --- Rooms ----------------------------------------------------------------

export function canManageRoom(
  user: ResourceCapabilityUser | null,
  ownerDepartmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, ownerDepartmentId);
}

export function canManageRoomSharing(
  user: ResourceCapabilityUser | null,
  ownerDepartmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, ownerDepartmentId);
}

export function canManageRoomCapabilityAssignment(
  user: ResourceCapabilityUser | null,
  ownerDepartmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, ownerDepartmentId);
}

export function canManageRoomAvailability(
  user: ResourceCapabilityUser | null,
  ownerDepartmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, ownerDepartmentId);
}

/** Room requirements follow the teaching component's managing department. */
export function canManageRoomRequirement(
  user: ResourceCapabilityUser | null,
  componentManagingDepartmentId: number | null | undefined,
): boolean {
  return canManageDepartment(user, componentManagingDepartmentId);
}

// --- Calendar exceptions --------------------------------------------------

/**
 * True when the user may create an exception for a scope at all.
 *
 * `COLLEGE` belongs to college administrators; every narrower scope needs a
 * department, and the target is checked separately.
 */
export function canCreateExceptionForScope(
  user: ResourceCapabilityUser | null,
  scope: ExceptionScope,
): boolean {
  if (!canManageResources(user)) {
    return false;
  }
  if (scope === 'COLLEGE') {
    return hasCrossDepartmentAccess(user);
  }
  return ownDepartmentId(user) !== null || hasCrossDepartmentAccess(user);
}

/**
 * True when the user owns the resource the exception targets.
 *
 * A shared foreign instructor or room stays visible without granting the
 * department authority over its exceptions.
 */
export function canManageCalendarException(
  user: ResourceCapabilityUser | null,
  targetOwnerDepartmentId: number | null | undefined,
  scope: ExceptionScope,
): boolean {
  if (!canManageResources(user)) {
    return false;
  }
  if (scope === 'COLLEGE') {
    return hasCrossDepartmentAccess(user);
  }
  return canManageDepartment(user, targetOwnerDepartmentId);
}

// --- Row badges -----------------------------------------------------------

export type ResourceRowBadge = RowAccessBadge;

export interface ShareableResource {
  ownerDepartmentId: number | null;
  sharingScope: SharingScope;
}

/**
 * Badge for an instructor or room row.
 *
 * Visibility alone never means "shared": an instructor visible only because of a
 * joint teaching assignment keeps `PRIVATE` scope and is labelled read-only, not
 * shared, so nobody concludes the department can schedule it.
 */
export function shareableResourceBadge(
  user: ResourceCapabilityUser | null,
  resource: ShareableResource,
): ResourceRowBadge {
  if (isSchedulerReadOnly(user) || !canManageResources(user)) {
    return 'read-only';
  }
  if (canManageDepartment(user, resource.ownerDepartmentId)) {
    return 'owned';
  }
  if (resource.sharingScope === 'COLLEGE_WIDE') {
    return 'college-wide';
  }
  if (resource.sharingScope === 'SELECTED_DEPARTMENTS') {
    return 'shared';
  }
  return 'read-only';
}

/** Badge for a row that follows a teaching component's managing department. */
export function componentOwnedRowBadge(
  user: ResourceCapabilityUser | null,
  managingDepartmentId: number | null | undefined,
): ResourceRowBadge | null {
  if (canManageDepartment(user, managingDepartmentId)) {
    return null;
  }
  return 'external-owner';
}
