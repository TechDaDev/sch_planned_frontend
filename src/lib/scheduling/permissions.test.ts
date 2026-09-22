import { describe, expect, it } from 'vitest';

import {
  canAccessReports,
  canAccessSchedulingWorkspace,
  canApproveVersion,
  canCompareVersions,
  canExportPublished,
  canExportVersion,
  canGenerateCollegePreview,
  canGenerateDepartmentPreview,
  canImportSemesterPlan,
  canManageSchedule,
  canManualEditSchedule,
  canManualEditVersion,
  canPerformAction,
  canPersistCollegeDraft,
  canPersistDepartmentDraft,
  canPublishVersion,
  canReadScheduleHistory,
  canReviewVersion,
  canRunCollegeValidation,
  canRunDepartmentValidation,
  canRunValidation,
  canSubmitVersion,
  canViewAudit,
  canViewMyTimetable,
  canViewPublishedAnalytics,
  canViewPublishedTimetable,
  canViewVersionAnalytics,
  availableWorkflowAction,
  fixedDepartmentId,
  importDepartmentScope,
  isDepartmentlessScopedUser,
} from '@/lib/scheduling/permissions';
import type { VersionWorkflowContext } from '@/lib/scheduling/workflow';
import type { SchedulingCapabilityUser } from '@/lib/scheduling/permissions';
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

// --- F4 -------------------------------------------------------------------

const OWN_DEPARTMENT_SCHEDULE = {
  scheduleScope: 'DEPARTMENT' as const,
  scheduleDepartmentId: OWN,
};

const FOREIGN_DEPARTMENT_SCHEDULE = {
  scheduleScope: 'DEPARTMENT' as const,
  scheduleDepartmentId: FOREIGN,
};

const COLLEGE_SCHEDULE = {
  scheduleScope: 'COLLEGE' as const,
  scheduleDepartmentId: null,
};

function context(
  overrides: Partial<VersionWorkflowContext> = {},
): VersionWorkflowContext {
  return {
    ...OWN_DEPARTMENT_SCHEDULE,
    status: 'DRAFT',
    isLatestVersion: true,
    ...overrides,
  };
}

describe('schedule scoping', () => {
  it('lets a college administrator reach every schedule', () => {
    expect(canManageSchedule(schedulingCollegeAdmin, 'COLLEGE', null)).toBe(true);
    expect(canManageSchedule(schedulingCollegeAdmin, 'DEPARTMENT', OWN)).toBe(true);
    expect(canManageSchedule(schedulingCollegeAdmin, 'DEPARTMENT', FOREIGN)).toBe(true);
  });

  it('confines a scoped role to its own department schedule', () => {
    expect(canManageSchedule(schedulingDepartmentAdmin, 'DEPARTMENT', OWN)).toBe(true);
    expect(canManageSchedule(schedulingDepartmentAdmin, 'DEPARTMENT', FOREIGN)).toBe(false);
    expect(canManageSchedule(schedulingScheduler, 'DEPARTMENT', FOREIGN)).toBe(false);
  });

  it('never gives a read-only role or a scoped role the college-wide schedule', () => {
    expect(canManageSchedule(schedulingDepartmentAdmin, 'COLLEGE', null)).toBe(false);
    expect(canManageSchedule(schedulingScheduler, 'COLLEGE', null)).toBe(false);
    expect(canManageSchedule(schedulingViewer, 'DEPARTMENT', OWN)).toBe(false);
    expect(canManageSchedule(schedulingInstructor, 'DEPARTMENT', OWN)).toBe(false);
  });

  it('fails closed for an unassigned scoped account or a missing user', () => {
    expect(canManageSchedule(schedulingUnassignedAdmin, 'DEPARTMENT', OWN)).toBe(false);
    expect(canManageSchedule(schedulingUnassignedScheduler, 'DEPARTMENT', OWN)).toBe(false);
    expect(canManageSchedule(null, 'DEPARTMENT', OWN)).toBe(false);
  });
});

describe('manual edit permissions', () => {
  it('admits the three editing roles on a newest draft of their own schedule', () => {
    expect(canManualEditVersion(schedulingCollegeAdmin, context())).toBe(true);
    expect(canManualEditVersion(schedulingDepartmentAdmin, context())).toBe(true);
    expect(canManualEditVersion(schedulingScheduler, context())).toBe(true);
  });

  it('refuses a viewer and an instructor', () => {
    expect(canManualEditSchedule(schedulingViewer)).toBe(false);
    expect(canManualEditVersion(schedulingViewer, context())).toBe(false);
    expect(canManualEditVersion(schedulingInstructor, context())).toBe(false);
  });

  it('refuses a foreign department and the college schedule', () => {
    expect(canManualEditVersion(schedulingDepartmentAdmin, context(FOREIGN_DEPARTMENT_SCHEDULE))).toBe(
      false,
    );
    expect(canManualEditVersion(schedulingScheduler, context(COLLEGE_SCHEDULE))).toBe(false);
  });

  it('refuses anything that is not the newest DRAFT', () => {
    expect(canManualEditVersion(schedulingCollegeAdmin, context({ status: 'SUBMITTED' }))).toBe(false);
    expect(canManualEditVersion(schedulingCollegeAdmin, context({ status: 'PUBLISHED' }))).toBe(false);
    expect(canManualEditVersion(schedulingCollegeAdmin, context({ status: null }))).toBe(false);
    expect(canManualEditVersion(schedulingCollegeAdmin, context({ isLatestVersion: false }))).toBe(
      false,
    );
    // Unknown latest-state fails closed rather than assuming it is the newest.
    expect(canManualEditVersion(schedulingCollegeAdmin, context({ isLatestVersion: null }))).toBe(
      false,
    );
    expect(canManualEditVersion(schedulingCollegeAdmin, context({ isLatestVersion: undefined }))).toBe(
      false,
    );
  });

  it('refuses an unassigned scoped account', () => {
    expect(canManualEditVersion(schedulingUnassignedScheduler, context())).toBe(false);
    expect(canManualEditVersion(null, context())).toBe(false);
  });
});

describe('workflow action permissions', () => {
  it('lets the workflow roles submit their own newest draft', () => {
    expect(canSubmitVersion(schedulingCollegeAdmin, context())).toBe(true);
    expect(canSubmitVersion(schedulingDepartmentAdmin, context())).toBe(true);
    expect(canSubmitVersion(schedulingScheduler, context())).toBe(true);
  });

  it('refuses submit from a status other than DRAFT', () => {
    expect(canSubmitVersion(schedulingScheduler, context({ status: 'SUBMITTED' }))).toBe(false);
    expect(canSubmitVersion(schedulingScheduler, context({ status: null }))).toBe(false);
  });

  it('reserves review and approve for a college administrator', () => {
    const submitted = context({ status: 'SUBMITTED' });
    const reviewed = context({ status: 'REVIEWED' });

    expect(canReviewVersion(schedulingCollegeAdmin, submitted)).toBe(true);
    expect(canApproveVersion(schedulingCollegeAdmin, reviewed)).toBe(true);
    // A department administrator may not review its own submission.
    expect(canReviewVersion(schedulingDepartmentAdmin, submitted)).toBe(false);
    expect(canApproveVersion(schedulingDepartmentAdmin, reviewed)).toBe(false);
    expect(canReviewVersion(schedulingScheduler, submitted)).toBe(false);
    expect(canApproveVersion(schedulingViewer, reviewed)).toBe(false);
  });

  it('never reviews or approves from the wrong stage', () => {
    expect(canReviewVersion(schedulingCollegeAdmin, context({ status: 'DRAFT' }))).toBe(false);
    expect(canApproveVersion(schedulingCollegeAdmin, context({ status: 'SUBMITTED' }))).toBe(false);
  });

  it('publishes only an approved, college-wide schedule', () => {
    const approved = context({ ...COLLEGE_SCHEDULE, status: 'APPROVED' });

    expect(canPublishVersion(schedulingCollegeAdmin, approved)).toBe(true);
    expect(
      canPublishVersion(schedulingCollegeAdmin, context({ status: 'APPROVED' })),
    ).toBe(false);
    expect(
      canPublishVersion(
        schedulingCollegeAdmin,
        context({ ...COLLEGE_SCHEDULE, status: 'REVIEWED' }),
      ),
    ).toBe(false);
  });

  it('refuses every workflow action to a viewer or an unassigned account', () => {
    for (const action of ['SUBMIT', 'REVIEW', 'APPROVE', 'PUBLISH'] as const) {
      const status =
        action === 'SUBMIT'
          ? 'DRAFT'
          : action === 'REVIEW'
            ? 'SUBMITTED'
            : action === 'APPROVE'
              ? 'REVIEWED'
              : 'APPROVED';
      const ctx = context({ ...COLLEGE_SCHEDULE, status });
      expect(canPerformAction(schedulingViewer, action, ctx)).toBe(false);
      expect(canPerformAction(schedulingInstructor, action, ctx)).toBe(false);
      expect(canPerformAction(schedulingUnassignedAdmin, action, ctx)).toBe(false);
      expect(canPerformAction(null, action, ctx)).toBe(false);
    }
  });

  it('never advances a version that is not the newest one', () => {
    for (const action of ['SUBMIT', 'REVIEW', 'APPROVE', 'PUBLISH'] as const) {
      const status =
        action === 'SUBMIT'
          ? 'DRAFT'
          : action === 'REVIEW'
            ? 'SUBMITTED'
            : action === 'APPROVE'
              ? 'REVIEWED'
              : 'APPROVED';
      expect(
        canPerformAction(
          schedulingCollegeAdmin,
          action,
          context({ ...COLLEGE_SCHEDULE, status, isLatestVersion: false }),
        ),
      ).toBe(false);
    }
  });

  it('offers exactly one action, which is the status successor', () => {
    expect(availableWorkflowAction(schedulingCollegeAdmin, context({ status: 'DRAFT' }))).toBe(
      'SUBMIT',
    );
    expect(
      availableWorkflowAction(
        schedulingCollegeAdmin,
        context({ ...COLLEGE_SCHEDULE, status: 'SUBMITTED' }),
      ),
    ).toBe('REVIEW');
    expect(
      availableWorkflowAction(
        schedulingCollegeAdmin,
        context({ ...COLLEGE_SCHEDULE, status: 'REVIEWED' }),
      ),
    ).toBe('APPROVE');
    expect(
      availableWorkflowAction(
        schedulingCollegeAdmin,
        context({ ...COLLEGE_SCHEDULE, status: 'APPROVED' }),
      ),
    ).toBe('PUBLISH');
    expect(
      availableWorkflowAction(
        schedulingCollegeAdmin,
        context({ ...COLLEGE_SCHEDULE, status: 'PUBLISHED' }),
      ),
    ).toBeNull();
  });

  it('offers no publish action for a department schedule at any stage', () => {
    expect(
      availableWorkflowAction(schedulingCollegeAdmin, context({ status: 'APPROVED' })),
    ).toBeNull();
    // A reviewed department version still offers the approve step, never a publish.
    expect(
      availableWorkflowAction(schedulingCollegeAdmin, context({ status: 'REVIEWED' })),
    ).toBe('APPROVE');
    expect(
      availableWorkflowAction(
        schedulingCollegeAdmin,
        context({ ...COLLEGE_SCHEDULE, status: 'APPROVED' }),
      ),
    ).toBe('PUBLISH');
  });

  it('offers a department administrator exactly the submit action', () => {
    expect(availableWorkflowAction(schedulingDepartmentAdmin, context())).toBe('SUBMIT');
    expect(
      availableWorkflowAction(schedulingDepartmentAdmin, context({ status: 'SUBMITTED' })),
    ).toBeNull();
  });
});

describe('report and analytics permissions', () => {
  it('gives version analytics to the schedule-read roles', () => {
    expect(canViewVersionAnalytics(schedulingCollegeAdmin)).toBe(true);
    expect(canViewVersionAnalytics(schedulingScheduler)).toBe(true);
    expect(canViewVersionAnalytics(schedulingViewer)).toBe(true);
    expect(canViewVersionAnalytics(schedulingInstructor)).toBe(false);
    expect(canViewVersionAnalytics(schedulingUnassignedScheduler)).toBe(false);
  });

  it('gives published analytics to management and read roles, never an instructor', () => {
    expect(canViewPublishedAnalytics(schedulingCollegeAdmin)).toBe(true);
    expect(canViewPublishedAnalytics(schedulingDepartmentAdmin)).toBe(true);
    expect(canViewPublishedAnalytics(schedulingScheduler)).toBe(true);
    expect(canViewPublishedAnalytics(schedulingViewer)).toBe(true);
    expect(canViewPublishedAnalytics(schedulingInstructor)).toBe(false);
  });

  it('keeps exports aligned with the analytics they describe', () => {
    expect(canExportVersion(schedulingViewer)).toBe(true);
    expect(canExportVersion(schedulingInstructor)).toBe(false);
    expect(canExportPublished(schedulingCollegeAdmin)).toBe(true);
    expect(canExportPublished(schedulingInstructor)).toBe(false);
    expect(canAccessReports(schedulingUnassignedScheduler)).toBe(false);
  });
});

describe('official timetable and personal timetable', () => {
  it('lets every signed-in role read the official timetable', () => {
    for (const user of [
      schedulingCollegeAdmin,
      schedulingDepartmentAdmin,
      schedulingScheduler,
      schedulingViewer,
      schedulingInstructor,
    ]) {
      expect(canViewPublishedTimetable(user)).toBe(true);
    }
    expect(canViewPublishedTimetable(null)).toBe(false);
    expect(canViewPublishedTimetable({ role: 'ADMIN', department: null } as unknown as SchedulingCapabilityUser)).toBe(false);
  });

  it('reserves the personal timetable for the instructor role', () => {
    expect(canViewMyTimetable(schedulingInstructor)).toBe(true);
    expect(canViewMyTimetable(schedulingCollegeAdmin)).toBe(false);
    expect(canViewMyTimetable(schedulingViewer)).toBe(false);
    expect(canViewMyTimetable(null)).toBe(false);
  });
});

describe('import permissions', () => {
  it('admits only the two administrator roles', () => {
    expect(canImportSemesterPlan(schedulingCollegeAdmin)).toBe(true);
    expect(canImportSemesterPlan(schedulingDepartmentAdmin)).toBe(true);
    expect(canImportSemesterPlan(schedulingScheduler)).toBe(false);
    expect(canImportSemesterPlan(schedulingViewer)).toBe(false);
    expect(canImportSemesterPlan(schedulingInstructor)).toBe(false);
  });

  it('fixes a department administrator to its own department', () => {
    expect(importDepartmentScope(schedulingDepartmentAdmin)).toEqual({
      fixed: OWN,
      mayChoose: false,
    });
  });

  it('lets a college administrator choose the department', () => {
    expect(importDepartmentScope(schedulingCollegeAdmin)).toEqual({
      fixed: null,
      mayChoose: true,
    });
  });

  it('refuses a role that may not import and an unassigned scoped account', () => {
    expect(importDepartmentScope(schedulingScheduler)).toEqual({ fixed: null, mayChoose: false });
    expect(importDepartmentScope(schedulingUnassignedAdmin)).toEqual({
      fixed: null,
      mayChoose: false,
    });
    expect(canImportSemesterPlan(schedulingUnassignedAdmin)).toBe(false);
  });
});

describe('audit permissions', () => {
  it('admits the two administrator roles only', () => {
    expect(canViewAudit(schedulingCollegeAdmin)).toBe(true);
    expect(canViewAudit(schedulingDepartmentAdmin)).toBe(true);
    expect(canViewAudit(schedulingScheduler)).toBe(false);
    expect(canViewAudit(schedulingViewer)).toBe(false);
    expect(canViewAudit(schedulingInstructor)).toBe(false);
  });

  it('refuses an unassigned scoped account and a missing user', () => {
    expect(canViewAudit(schedulingUnassignedAdmin)).toBe(false);
    expect(canViewAudit(null)).toBe(false);
  });
});
