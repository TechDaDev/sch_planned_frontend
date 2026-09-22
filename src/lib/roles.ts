/**
 * Application roles.
 *
 * The list mirrors `accounts.models.UserRole` of the accepted backend
 * (Backend API v1.0.0) exactly. Roles that do not exist in the backend must
 * never be invented here: an unrecognized role is treated as unusable rather
 * than being mapped onto a privileged one.
 */

export const USER_ROLES = [
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
  'VIEWER',
  'INSTRUCTOR',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Human readable role labels for the UI. */
export const ROLE_LABELS: Record<UserRole, string> = {
  COLLEGE_ADMIN: 'College Administrator',
  DEPARTMENT_ADMIN: 'Department Administrator',
  SCHEDULER: 'Scheduler',
  VIEWER: 'Viewer',
  INSTRUCTOR: 'Instructor',
};

/**
 * Roles whose data access is scoped to a single department.
 *
 * `COLLEGE_ADMIN` is not listed: a college administrator legitimately has no
 * department and still has cross-department access (`has_cross_department_access`
 * in the backend).
 */
export const DEPARTMENT_SCOPED_ROLES = [
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
  'VIEWER',
  'INSTRUCTOR',
] as const;

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
  );
}

/**
 * Parse an untrusted role value.
 *
 * Returns `null` for anything the backend did not define, so callers can fail
 * safely instead of defaulting to a privileged role.
 */
export function parseUserRole(value: unknown): UserRole | null {
  return isUserRole(value) ? value : null;
}

export function isDepartmentScopedRole(role: UserRole): boolean {
  return (DEPARTMENT_SCOPED_ROLES as readonly string[]).includes(role);
}

export function getRoleLabel(role: string): string {
  return isUserRole(role) ? ROLE_LABELS[role] : 'Unknown role';
}
