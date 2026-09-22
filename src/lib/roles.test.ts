import { describe, expect, it } from 'vitest';

import {
  getRoleLabel,
  isDepartmentScopedRole,
  isUserRole,
  parseUserRole,
  ROLE_LABELS,
  USER_ROLES,
} from '@/lib/roles';

describe('roles', () => {
  it('exposes exactly the backend roles', () => {
    expect([...USER_ROLES]).toEqual([
      'COLLEGE_ADMIN',
      'DEPARTMENT_ADMIN',
      'SCHEDULER',
      'VIEWER',
      'INSTRUCTOR',
    ]);
    expect(Object.keys(ROLE_LABELS)).toHaveLength(5);
  });

  it('accepts every backend role', () => {
    for (const role of USER_ROLES) {
      expect(parseUserRole(role)).toBe(role);
      expect(isUserRole(role)).toBe(true);
    }
  });

  it('fails safely for roles the backend does not define', () => {
    for (const value of ['ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STAFF', 'admin', '', null]) {
      expect(parseUserRole(value)).toBeNull();
    }
    expect(parseUserRole(42)).toBeNull();
    expect(parseUserRole({ role: 'COLLEGE_ADMIN' })).toBeNull();
  });

  it('labels unknown roles without granting access', () => {
    expect(getRoleLabel('COLLEGE_ADMIN')).toBe('College Administrator');
    expect(getRoleLabel('ADMIN')).toBe('Unknown role');
  });

  it('marks department-scoped roles', () => {
    expect(isDepartmentScopedRole('DEPARTMENT_ADMIN')).toBe(true);
    expect(isDepartmentScopedRole('SCHEDULER')).toBe(true);
    expect(isDepartmentScopedRole('VIEWER')).toBe(true);
    expect(isDepartmentScopedRole('INSTRUCTOR')).toBe(true);
    // A college administrator is college-wide and may legitimately have no
    // department.
    expect(isDepartmentScopedRole('COLLEGE_ADMIN')).toBe(false);
  });
});
