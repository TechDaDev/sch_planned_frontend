import { describe, expect, it } from 'vitest';

import {
  canAccessSchedulingWorkspace,
  canCompareVersions,
  canGenerateCollegePreview,
  canGenerateDepartmentPreview,
  canPersistCollegeDraft,
  canPersistDepartmentDraft,
  canReadScheduleHistory,
  canRunCollegeValidation,
  canRunDepartmentValidation,
  canRunValidation,
  fixedDepartmentId,
  isDepartmentlessScopedUser,
} from '@/lib/scheduling/permissions';
import {
  schedulingCollegeAdmin,
  schedulingDepartmentAdmin,
  schedulingInstructor,
  schedulingOtherDepartmentAdmin,
  schedulingScheduler,
  schedulingUnassignedAdmin,
  schedulingUnassignedScheduler,
  schedulingViewer,
  BIOAI_DEPARTMENT,
  CS_DEPARTMENT,
} from '@/test/scheduling-fixtures';

const OWN = BIOAI_DEPARTMENT.id;
const FOREIGN = CS_DEPARTMENT.id;

describe('scheduling workspace access', () => {
  it('admits the four roles that may read persisted schedules', () => {
    expect(canAccessSchedulingWorkspace(schedulingCollegeAdmin)).toBe(true);
    expect(canAccessSchedulingWorkspace(schedulingDepartmentAdmin)).toBe(true);
    expect(canAccessSchedulingWorkspace(schedulingScheduler)).toBe(true);
    expect(canAccessSchedulingWorkspace(schedulingViewer)).toBe(true);
  });

  it('keeps the instructor role out of scheduling administration', () => {
    expect(canAccessSchedulingWorkspace(schedulingInstructor)).toBe(false);
    expect(canReadScheduleHistory(schedulingInstructor)).toBe(false);
  });

  it('treats a missing user as no access', () => {
    expect(canAccessSchedulingWorkspace(null)).toBe(false);
    expect(canReadScheduleHistory(null)).toBe(false);
    expect(canRunValidation(null)).toBe(false);
  });
});

describe('readiness validation permissions', () => {
  it('lets a college administrator validate the college and any department', () => {
    expect(canRunCollegeValidation(schedulingCollegeAdmin)).toBe(true);
    expect(canRunDepartmentValidation(schedulingCollegeAdmin, OWN)).toBe(true);
    expect(canRunDepartmentValidation(schedulingCollegeAdmin, FOREIGN)).toBe(true);
  });

  it('restricts a department administrator to its own department', () => {
    expect(canRunCollegeValidation(schedulingDepartmentAdmin)).toBe(false);
    expect(canRunDepartmentValidation(schedulingDepartmentAdmin, OWN)).toBe(true);
    expect(canRunDepartmentValidation(schedulingDepartmentAdmin, FOREIGN)).toBe(false);
  });

  it('restricts a scheduler to its own department', () => {
    expect(canRunCollegeValidation(schedulingScheduler)).toBe(false);
    expect(canRunDepartmentValidation(schedulingScheduler, OWN)).toBe(true);
    expect(canRunDepartmentValidation(schedulingScheduler, FOREIGN)).toBe(false);
  });

  it('denies validation to viewers and instructors', () => {
    expect(canRunValidation(schedulingViewer)).toBe(false);
    expect(canRunDepartmentValidation(schedulingViewer, OWN)).toBe(false);
    expect(canRunValidation(schedulingInstructor)).toBe(false);
  });

  it('fails closed for a department-scoped account with no department', () => {
    expect(isDepartmentlessScopedUser(schedulingUnassignedAdmin)).toBe(true);
    expect(canRunValidation(schedulingUnassignedAdmin)).toBe(false);
    expect(canRunDepartmentValidation(schedulingUnassignedAdmin, null)).toBe(false);
    expect(canRunDepartmentValidation(schedulingUnassignedAdmin, OWN)).toBe(false);
    expect(canReadScheduleHistory(schedulingUnassignedAdmin)).toBe(false);

    expect(isDepartmentlessScopedUser(schedulingUnassignedScheduler)).toBe(true);
    expect(canRunValidation(schedulingUnassignedScheduler)).toBe(false);
    expect(canReadScheduleHistory(schedulingUnassignedScheduler)).toBe(false);
  });

  it('never treats a college administrator as departmentless', () => {
    expect(isDepartmentlessScopedUser(schedulingCollegeAdmin)).toBe(false);
  });
});

describe('generation permissions', () => {
  it('lets a college administrator preview and persist both scopes', () => {
    expect(canGenerateCollegePreview(schedulingCollegeAdmin)).toBe(true);
    expect(canGenerateDepartmentPreview(schedulingCollegeAdmin, FOREIGN)).toBe(true);
    expect(canPersistCollegeDraft(schedulingCollegeAdmin)).toBe(true);
    expect(canPersistDepartmentDraft(schedulingCollegeAdmin, FOREIGN)).toBe(true);
  });

  it('never offers college-wide generation to a department-scoped role', () => {
    for (const user of [
      schedulingDepartmentAdmin,
      schedulingScheduler,
      schedulingOtherDepartmentAdmin,
      schedulingViewer,
    ]) {
      expect(canGenerateCollegePreview(user)).toBe(false);
      expect(canPersistCollegeDraft(user)).toBe(false);
    }
  });

  it('keeps department generation inside the own department', () => {
    expect(canGenerateDepartmentPreview(schedulingDepartmentAdmin, OWN)).toBe(true);
    expect(canGenerateDepartmentPreview(schedulingDepartmentAdmin, FOREIGN)).toBe(false);
    expect(canPersistDepartmentDraft(schedulingDepartmentAdmin, FOREIGN)).toBe(false);
    expect(canGenerateDepartmentPreview(schedulingScheduler, OWN)).toBe(true);
    expect(canPersistDepartmentDraft(schedulingScheduler, FOREIGN)).toBe(false);
  });

  it('denies generation to viewers', () => {
    expect(canGenerateDepartmentPreview(schedulingViewer, OWN)).toBe(false);
    expect(canPersistDepartmentDraft(schedulingViewer, OWN)).toBe(false);
  });
});

describe('history permissions', () => {
  it('lets a viewer read and compare history but generate nothing', () => {
    expect(canReadScheduleHistory(schedulingViewer)).toBe(true);
    expect(canCompareVersions(schedulingViewer)).toBe(true);
    expect(canGenerateDepartmentPreview(schedulingViewer, OWN)).toBe(false);
    expect(canPersistCollegeDraft(schedulingViewer)).toBe(false);
  });

  it('fixes the department of a scoped role and leaves it open for a college admin', () => {
    expect(fixedDepartmentId(schedulingDepartmentAdmin)).toBe(OWN);
    expect(fixedDepartmentId(schedulingScheduler)).toBe(OWN);
    expect(fixedDepartmentId(schedulingUnassignedAdmin)).toBeNull();
    expect(fixedDepartmentId(schedulingCollegeAdmin)).toBeNull();
  });
});
