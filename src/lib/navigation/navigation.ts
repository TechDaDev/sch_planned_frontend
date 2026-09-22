/**
 * Central navigation configuration.
 *
 * Role visibility is defined once, here, instead of being scattered through JSX
 * literals. Frontend navigation is a usability affordance only: the backend
 * remains the authorization authority.
 */

import { isDepartmentScopedRole, parseUserRole, type UserRole } from '@/lib/roles';

export type NavIconKey =
  | 'dashboard'
  | 'academic'
  | 'resources'
  | 'scheduling'
  | 'reports'
  | 'audit'
  | 'timetable'
  | 'published'
  | 'imports'
  | 'forbidden';

export interface NavItem {
  href: string;
  label: string;
  description: string;
  iconKey: NavIconKey;
  roles: readonly UserRole[];
}

const ALL_ROLES: readonly UserRole[] = [
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
  'VIEWER',
  'INSTRUCTOR',
];

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Session summary and available modules.',
    iconKey: 'dashboard',
    roles: ALL_ROLES,
  },
  {
    href: '/academic',
    label: 'Academic Setup',
    description: 'Colleges, departments, programs, stages and courses.',
    iconKey: 'academic',
    roles: ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'],
  },
  {
    href: '/resources',
    label: 'Resources',
    description: 'Rooms, instructors and teaching resources.',
    iconKey: 'resources',
    roles: ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SCHEDULER'],
  },
  {
    href: '/scheduling',
    label: 'Scheduling',
    description: 'Timetable generation and manual timetable editing.',
    iconKey: 'scheduling',
    roles: ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SCHEDULER', 'VIEWER'],
  },
  {
    href: '/published',
    label: 'Official Timetable',
    description: 'The published timetable of a semester.',
    iconKey: 'published',
    roles: ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SCHEDULER', 'VIEWER'],
  },
  {
    href: '/reports',
    label: 'Reports',
    description: 'Analytics and Excel/PDF exports.',
    iconKey: 'reports',
    roles: ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SCHEDULER', 'VIEWER'],
  },
  {
    href: '/imports',
    label: 'Imports',
    description: 'Semester teaching plan workbook import.',
    iconKey: 'imports',
    roles: ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'],
  },
  {
    href: '/audit',
    label: 'Audit',
    description: 'Workflow and change history.',
    iconKey: 'audit',
    roles: ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'],
  },
  {
    href: '/my-timetable',
    label: 'My Timetable',
    description: 'Your personal teaching timetable.',
    iconKey: 'timetable',
    roles: ['INSTRUCTOR'],
  },
];

/** Paths that are reachable regardless of role (presentational states). */
const ALWAYS_ALLOWED_PATHS: readonly string[] = ['/forbidden'];

/**
 * Destinations whose data is department-scoped on the backend.
 *
 * A department-scoped role without an assigned department gets a clear
 * restricted state on these pages instead of an empty or misleading view.
 */
export const DEPARTMENT_SCOPED_PATHS: readonly string[] = [
  '/academic',
  '/resources',
  '/scheduling',
  '/published',
  '/reports',
  '/imports',
  '/audit',
];

/**
 * Navigation items visible to a role.
 *
 * An unknown or missing role yields an empty navigation (fail safe).
 */
export function getNavigationForRole(role: unknown): NavItem[] {
  const parsed = parseUserRole(role);
  if (parsed === null) {
    return [];
  }
  return NAV_ITEMS.filter((item) => item.roles.includes(parsed));
}

function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split('?')[0] ?? '';
  const withoutTrailingSlash = withoutQuery.replace(/\/+$/, '');
  return withoutTrailingSlash.length === 0 ? '/' : withoutTrailingSlash;
}

/** Navigation item owning a path, using the longest matching prefix. */
export function findNavItemForPath(
  role: unknown,
  pathname: string,
): NavItem | null {
  const target = normalizePath(pathname);
  const candidates = getNavigationForRole(role).filter(
    (item) =>
      target === item.href || target.startsWith(`${item.href}/`),
  );
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((longest, item) =>
    item.href.length > longest.href.length ? item : longest,
  );
}

/**
 * Whether a role may view a path in the UI.
 *
 * `/dashboard` and `/forbidden` are always viewable; an unknown role sees
 * nothing else.
 */
export function canAccessPath(role: unknown, pathname: string): boolean {
  const target = normalizePath(pathname);
  if (ALWAYS_ALLOWED_PATHS.includes(target) || target === '/dashboard') {
    return parseUserRole(role) !== null;
  }
  return findNavItemForPath(role, target) !== null;
}

/** True for destinations whose data is scoped to a department. */
export function isDepartmentScopedPath(pathname: string): boolean {
  const target = normalizePath(pathname);
  return DEPARTMENT_SCOPED_PATHS.some(
    (path) => target === path || target.startsWith(`${path}/`),
  );
}

/**
 * True when the role is department-scoped and the account has no department.
 *
 * `COLLEGE_ADMIN` is college-wide and legitimately has no department, so it is
 * never restricted by this check.
 */
export function needsDepartmentAssignment(
  role: unknown,
  department: { id: number } | null | undefined,
): boolean {
  const parsed = parseUserRole(role);
  if (parsed === null) {
    return false;
  }
  return isDepartmentScopedRole(parsed) && !department;
}
