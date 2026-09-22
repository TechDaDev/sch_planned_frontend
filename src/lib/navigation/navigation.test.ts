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
      'Official Timetable',
      'Reports',
      'Imports',
      'Audit',
    ]);
  });

  it('matches the department administrator matrix', () => {
    expect(labels('DEPARTMENT_ADMIN')).toEqual(labels('COLLEGE_ADMIN'));
  });

  it('excludes Audit and Imports for a scheduler', () => {
    expect(labels('SCHEDULER')).toEqual([
      'Dashboard',
      'Resources',
      'Scheduling',
      'Official Timetable',
      'Reports',
    ]);
    expect(labels('SCHEDULER')).not.toContain('Audit');
    expect(labels('SCHEDULER')).not.toContain('Imports');
  });

  it('excludes Academic Setup, Imports and Audit for a viewer', () => {
    expect(labels('VIEWER')).toEqual([
      'Dashboard',
      'Scheduling',
      'Official Timetable',
      'Reports',
    ]);
    expect(labels('VIEWER')).not.toContain('Academic Setup');
    expect(labels('VIEWER')).not.toContain('Imports');
    expect(labels('VIEWER')).not.toContain('Audit');
  });

  it('limits an instructor to the dashboard and personal timetable', () => {
    expect(labels('INSTRUCTOR')).toEqual(['Dashboard', 'My Timetable']);
    expect(labels('INSTRUCTOR')).not.toContain('Audit');
    expect(labels('INSTRUCTOR')).not.toContain('Resources');
    expect(labels('INSTRUCTOR')).not.toContain('Imports');
    expect(labels('INSTRUCTOR')).not.toContain('Reports');
    expect(labels('INSTRUCTOR')).not.toContain('Official Timetable');
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

  it('resolves the F4 destinations for the roles that own them', () => {
    expect(findNavItemForPath('COLLEGE_ADMIN', '/published')?.href).toBe('/published');
    expect(
      findNavItemForPath('COLLEGE_ADMIN', '/reports/version/12')?.href,
    ).toBe('/reports');
    expect(findNavItemForPath('COLLEGE_ADMIN', '/reports/published')?.href).toBe('/reports');
    expect(
      findNavItemForPath('DEPARTMENT_ADMIN', '/imports/semester-plan')?.href,
    ).toBe('/imports');
    expect(
      findNavItemForPath('COLLEGE_ADMIN', '/scheduling/versions/4/edit')?.href,
    ).toBe('/scheduling');
    expect(
      findNavItemForPath('COLLEGE_ADMIN', '/scheduling/versions/4/workflow')?.href,
    ).toBe('/scheduling');
    // A scheduler may read the official timetable and reports, but not import or audit.
    expect(canAccessPath('SCHEDULER', '/published')).toBe(true);
    expect(canAccessPath('SCHEDULER', '/imports/semester-plan')).toBe(false);
    // An instructor reaches neither management destination.
    expect(canAccessPath('INSTRUCTOR', '/published')).toBe(false);
    expect(canAccessPath('INSTRUCTOR', '/reports')).toBe(false);
  });
});

describe('department handling', () => {
  it('flags department-scoped destinations', () => {
    expect(isDepartmentScopedPath('/scheduling')).toBe(true);
    expect(isDepartmentScopedPath('/reports/exports')).toBe(true);
    expect(isDepartmentScopedPath('/published')).toBe(true);
    expect(isDepartmentScopedPath('/imports/semester-plan')).toBe(true);
    expect(isDepartmentScopedPath('/audit/9f0f6e3e')).toBe(true);
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
