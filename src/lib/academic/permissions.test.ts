import { describe, expect, it } from 'vitest';

import {
  departmentAdmin,
  collegeAdmin,
  instructor,
  otherDepartmentAdmin,
  scheduler,
  unassignedDepartmentAdmin,
  viewer,
} from '@/test/academic-fixtures';
import {
  canAccessAcademicModule,
  canCreateDepartment,
  canEditDepartment,
  canManageAcademicYear,
  canManageCollege,
  canManageComponent,
  canManageComponentGroup,
  canManageDepartment,
  canManageDepartmentOwnedResource,
  canManageOffering,
  canManageSemester,
  componentGroupRowBadge,
  componentRowBadge,
  courseRowBadge,
  hasCrossDepartmentAccess,
  isUnassignedDepartmentAdmin,
  offeringRowBadge,
  ownDepartmentId,
} from '@/lib/academic/permissions';

describe('academic capability — college administrator', () => {
  it('manages every academic entity', () => {
    expect(canAccessAcademicModule(collegeAdmin)).toBe(true);
    expect(hasCrossDepartmentAccess(collegeAdmin)).toBe(true);
    expect(canManageCollege(collegeAdmin)).toBe(true);
    expect(canManageAcademicYear(collegeAdmin)).toBe(true);
    expect(canManageSemester(collegeAdmin)).toBe(true);
    expect(canCreateDepartment(collegeAdmin)).toBe(true);
    expect(canEditDepartment(collegeAdmin, 2)).toBe(true);
    expect(canManageDepartmentOwnedResource(collegeAdmin, 2)).toBe(true);
    expect(canManageOffering(collegeAdmin, 42)).toBe(true);
    expect(canManageComponent(collegeAdmin, 42)).toBe(true);
    expect(canManageComponentGroup(collegeAdmin, 2, 99)).toBe(true);
  });

  it('marks no row as read-only', () => {
    expect(courseRowBadge(collegeAdmin, 2)).toBeNull();
    expect(offeringRowBadge(collegeAdmin, 2)).toBeNull();
    expect(componentRowBadge(collegeAdmin, 2)).toBeNull();
    expect(componentGroupRowBadge(collegeAdmin, 2, 99)).toBeNull();
  });
});

describe('academic capability — department administrator', () => {
  it('manages resources of its own department', () => {
    expect(canAccessAcademicModule(departmentAdmin)).toBe(true);
    expect(hasCrossDepartmentAccess(departmentAdmin)).toBe(false);
    expect(canManageDepartment(departmentAdmin, 2)).toBe(true);
    expect(canEditDepartment(departmentAdmin, 2)).toBe(true);
    expect(canManageDepartmentOwnedResource(departmentAdmin, 2)).toBe(true);
    expect(canManageOffering(departmentAdmin, 2)).toBe(true);
    expect(canManageComponent(departmentAdmin, 2)).toBe(true);
    expect(canManageComponentGroup(departmentAdmin, 2, 2)).toBe(true);
  });

  it('cannot write college-wide records', () => {
    expect(canManageCollege(departmentAdmin)).toBe(false);
    expect(canManageAcademicYear(departmentAdmin)).toBe(false);
    expect(canManageSemester(departmentAdmin)).toBe(false);
  });

  it('cannot create or edit another department', () => {
    expect(canCreateDepartment(departmentAdmin)).toBe(false);
    expect(canEditDepartment(departmentAdmin, 99)).toBe(false);
    expect(canManageDepartmentOwnedResource(departmentAdmin, 99)).toBe(false);
    expect(canManageOffering(departmentAdmin, 99)).toBe(false);
  });

  it('needs both sides of a component group link to be its own department', () => {
    expect(canManageComponentGroup(departmentAdmin, 2, 99)).toBe(false);
    expect(canManageComponentGroup(departmentAdmin, 99, 2)).toBe(false);
    expect(canManageComponentGroup(departmentAdmin, 2, 2)).toBe(true);
  });

  it('treats foreign joint records as read-only', () => {
    expect(courseRowBadge(departmentAdmin, 99)).toBe('joint');
    expect(offeringRowBadge(departmentAdmin, 99)).toBe('external-manager');
    expect(componentRowBadge(departmentAdmin, 99)).toBe('external-manager');
    expect(componentGroupRowBadge(departmentAdmin, 99, 2)).toBe('external-manager');
    expect(componentGroupRowBadge(departmentAdmin, 2, 99)).toBe('joint');
  });

  it('ignores an unresolvable ownership path', () => {
    expect(canManageDepartment(departmentAdmin, null)).toBe(false);
    expect(canManageDepartment(departmentAdmin, undefined)).toBe(false);
  });
});

describe('academic capability — other departments and roles', () => {
  it('never manages another department as a department administrator', () => {
    expect(ownDepartmentId(otherDepartmentAdmin)).toBe(99);
    expect(canEditDepartment(otherDepartmentAdmin, 2)).toBe(false);
    expect(courseRowBadge(otherDepartmentAdmin, 2)).toBe('joint');
  });
});

describe('academic capability — fail closed cases', () => {
  it('restricts a department administrator without a department', () => {
    expect(isUnassignedDepartmentAdmin(unassignedDepartmentAdmin)).toBe(true);
    expect(ownDepartmentId(unassignedDepartmentAdmin)).toBeNull();
    expect(canManageDepartment(unassignedDepartmentAdmin, 2)).toBe(false);
    expect(canEditDepartment(unassignedDepartmentAdmin, 2)).toBe(false);
    expect(canManageDepartmentOwnedResource(unassignedDepartmentAdmin, 2)).toBe(false);
    expect(canCreateDepartment(unassignedDepartmentAdmin)).toBe(false);
    expect(canManageCollege(unassignedDepartmentAdmin)).toBe(false);
    expect(canManageAcademicYear(unassignedDepartmentAdmin)).toBe(false);
    expect(canManageSemester(unassignedDepartmentAdmin)).toBe(false);
  });

  it('denies academic administration to non-admin roles', () => {
    for (const role of [scheduler, viewer, instructor]) {
      expect(canAccessAcademicModule(role)).toBe(false);
      expect(canManageCollege(role)).toBe(false);
      expect(canManageAcademicYear(role)).toBe(false);
      expect(canManageSemester(role)).toBe(false);
      expect(canCreateDepartment(role)).toBe(false);
      expect(canEditDepartment(role, 2)).toBe(false);
      expect(canManageDepartmentOwnedResource(role, 2)).toBe(false);
      expect(canManageComponentGroup(role, 2, 2)).toBe(false);
    }
  });

  it('fails closed without a user', () => {
    expect(canAccessAcademicModule(null)).toBe(false);
    expect(canManageCollege(null)).toBe(false);
    expect(canManageDepartment(null, 2)).toBe(false);
    expect(canManageComponentGroup(null, 2, 2)).toBe(false);
  });
});
