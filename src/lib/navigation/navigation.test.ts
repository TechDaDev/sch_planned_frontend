import { describe, expect, it } from 'vitest';

import {
  canAccessPath,
  findNavItemForPath,
  getNavigationForRole,
  isDepartmentScopedPath,
  needsDepartmentAssignment,
} from '@/lib/navigation/navigation';

function labels(role: string): string[] {
  return getNavigationForRole(role).map((item) => item.label);
}

describe('role-aware navigation', () => {
  it('gives a college administrator every module', () => {
    expect(labels('COLLEGE_ADMIN')).toEqual([
      'Dashboard',
      'Academic Setup',
      'Resources',
      'Scheduling',
      'Reports',
      'Audit',
    ]);
  });

  it('matches the department administrator matrix', () => {
    expect(labels('DEPARTMENT_ADMIN')).toEqual(labels('COLLEGE_ADMIN'));
  });

  it('excludes Audit for a scheduler', () => {
    expect(labels('SCHEDULER')).toEqual([
      'Dashboard',
      'Resources',
      'Scheduling',
      'Reports',
    ]);
    expect(labels('SCHEDULER')).not.toContain('Audit');
  });

  it('excludes Academic Setup and Audit for a viewer', () => {
    expect(labels('VIEWER')).toEqual(['Dashboard', 'Scheduling', 'Reports']);
    expect(labels('VIEWER')).not.toContain('Academic Setup');
  });

  it('limits an instructor to the dashboard and personal timetable', () => {
    expect(labels('INSTRUCTOR')).toEqual(['Dashboard', 'My Timetable']);
    expect(labels('INSTRUCTOR')).not.toContain('Audit');
    expect(labels('INSTRUCTOR')).not.toContain('Resources');
  });

  it('fails safely for unknown roles', () => {
    expect(getNavigationForRole('ADMIN')).toEqual([]);
    expect(getNavigationForRole('SUPER_ADMIN')).toEqual([]);
    expect(getNavigationForRole(undefined)).toEqual([]);
    expect(canAccessPath('ADMIN', '/dashboard')).toBe(false);
  });
});

describe('path access', () => {
  it('allows a path owned by the role', () => {
    expect(canAccessPath('SCHEDULER', '/resources')).toBe(true);
    expect(canAccessPath('COLLEGE_ADMIN', '/audit')).toBe(true);
    expect(canAccessPath('INSTRUCTOR', '/my-timetable')).toBe(true);
  });

  it('denies a path the role does not own', () => {
    expect(canAccessPath('INSTRUCTOR', '/audit')).toBe(false);
    expect(canAccessPath('VIEWER', '/academic')).toBe(false);
    expect(canAccessPath('SCHEDULER', '/audit')).toBe(false);
  });

  it('keeps the dashboard and forbidden pages reachable', () => {
    expect(canAccessPath('INSTRUCTOR', '/dashboard')).toBe(true);
    expect(canAccessPath('VIEWER', '/forbidden')).toBe(true);
  });

  it('resolves nested paths to their navigation item', () => {
    expect(findNavItemForPath('COLLEGE_ADMIN', '/audit/records')?.href).toBe('/audit');
    expect(findNavItemForPath('VIEWER', '/audit/records')).toBeNull();
  });
});

describe('department handling', () => {
  it('flags department-scoped destinations', () => {
    expect(isDepartmentScopedPath('/scheduling')).toBe(true);
    expect(isDepartmentScopedPath('/reports/exports')).toBe(true);
    expect(isDepartmentScopedPath('/dashboard')).toBe(false);
    expect(isDepartmentScopedPath('/my-timetable')).toBe(false);
  });

  it('only requires a department for department-scoped roles', () => {
    expect(needsDepartmentAssignment('SCHEDULER', null)).toBe(true);
    expect(needsDepartmentAssignment('INSTRUCTOR', null)).toBe(true);
    expect(needsDepartmentAssignment('SCHEDULER', { id: 3 })).toBe(false);
    // A college administrator is college-wide.
    expect(needsDepartmentAssignment('COLLEGE_ADMIN', null)).toBe(false);
    expect(needsDepartmentAssignment('ADMIN', null)).toBe(false);
  });
});
