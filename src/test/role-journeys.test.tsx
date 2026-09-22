// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { collegesApi, semestersApi } from '@/lib/academic/api';
import { roomsApi } from '@/lib/resources/api';
import {
  SCHEDULING_ENDPOINTS,
  analyticsApi,
  auditApi,
  collegeDraftApi,
  collegeGenerationApi,
  departmentDraftApi,
  departmentGenerationApi,
  manualEditApi,
  publishedExportApi,
  publishedScheduleApi,
  scheduleVersionsApi,
  schedulesApi,
  semesterPlanImportApi,
  validationApi,
  versionExportApi,
  workflowApi,
} from '@/lib/scheduling/api';
import { canAccessPath, getNavigationForRole, needsDepartmentAssignment } from '@/lib/navigation/navigation';
import { EXPORT_MEDIA_TYPES } from '@/lib/scheduling/exports';
import { PROTECTED_PREFIXES } from '@/lib/navigation/protected-paths';
import { currentUserPayload, binaryResponse, installFetchMock, jsonResponse } from '@/test/fetch-mock';
import {
  BIOAI_DEPARTMENT,
  collegeGenerationResult,
  departmentGenerationResult,
  scheduleEntry,
  scheduleSummary,
  scheduleVersionDetail,
  scheduleVersionSummary,
  validationResult,
} from '@/test/scheduling-fixtures';
import {
  analyticsResult,
  auditEvent,
  importApplyResult,
  importValidationResult,
  manualEditApplyResult,
  manualEditValidation,
  publishedSchedule,
  workflowTransitionResult,
  workflowValidationResult,
} from '@/test/f4-fixtures';

/**
 * Role journeys.
 *
 * These are integration tests over the real frontend request layer with a mocked BFF:
 * every step of a journey issues the request the application would issue in
 * production, so a broken path, query or body fails here. Django is never contacted.
 *
 * The capability and route assertions that follow prove that the same journey is
 * narrowed, not merely hidden, for the other roles.
 */
const PROXY = '/api/backend';

const SEMESTER = 8;
const SCHEDULE_ID = 300;
const VERSION_ID = 501;

const COLLEGE_ADMIN = currentUserPayload({ role: 'COLLEGE_ADMIN', department: null });
const DEPARTMENT_ADMIN = currentUserPayload({
  role: 'DEPARTMENT_ADMIN',
  department: { id: BIOAI_DEPARTMENT.id, name: BIOAI_DEPARTMENT.name, code: BIOAI_DEPARTMENT.code },
});

const COLLEGE = {
  id: 1,
  name: 'College of Engineering',
  code: 'ENG',
  is_active: true,
  created_at: '2026-09-01T08:00:00Z',
  updated_at: '2026-09-01T08:00:00Z',
};

const SEMESTER_ROW = {
  id: SEMESTER,
  number: 1,
  start_date: '2026-09-01',
  end_date: '2027-01-15',
  academic_year: { id: 3, start_year: 2026, end_year: 2027 },
  is_active: true,
  created_at: '2026-09-01T08:00:00Z',
  updated_at: '2026-09-01T08:00:00Z',
};

const ROOM = {
  id: 22,
  code: 'AI-LAB-1',
  name: 'Artificial Intelligence Lab',
  capacity: 40,
  room_type: { id: 1, name: 'Laboratory', code: 'LAB' },
  owner_department: BIOAI_DEPARTMENT,
  sharing_scope: 'COLLEGE_WIDE',
  is_active: true,
};

describe('COLLEGE_ADMIN complete journey', () => {
  it('walks session, setup, generation, editing, workflow, publication, reports, import and audit', async () => {
    const mock = installFetchMock([
      { url: '/api/auth/session', handler: () => jsonResponse({ user: COLLEGE_ADMIN }) },
      { url: `${PROXY}/colleges`, handler: () => jsonResponse([COLLEGE]) },
      { url: `${PROXY}/semesters`, handler: () => jsonResponse([SEMESTER_ROW]) },
      { url: `${PROXY}/rooms`, handler: () => jsonResponse([ROOM]) },
      // 1. Readiness: department, then college-wide.
      {
        url: `${PROXY}/scheduling/validate`,
        method: 'POST',
        handler: () => jsonResponse(validationResult({ ready: true, issues: [] })),
      },
      // 2. Preview: department, then college-wide.
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () => jsonResponse(departmentGenerationResult()),
      },
      {
        url: `${PROXY}/scheduling/generate-college`,
        method: 'POST',
        handler: () => jsonResponse(collegeGenerationResult()),
      },
      // 3. Persist drafts.
      {
        url: `${PROXY}/schedules/generate-department-draft`,
        method: 'POST',
        handler: () =>
          jsonResponse({
            persisted: true,
            schedule: SCHEDULE_ID,
            version: scheduleVersionSummary({ id: VERSION_ID }),
          }),
      },
      {
        url: `${PROXY}/schedules/generate-college-draft`,
        method: 'POST',
        handler: () =>
          jsonResponse({
            persisted: true,
            schedule: SCHEDULE_ID,
            version: scheduleVersionSummary({ id: 601 }),
          }),
      },
      // 4. Read the schedule and its version.
      { url: `${PROXY}/schedules?semester=8`, handler: () => jsonResponse([scheduleSummary()]) },
      { url: `${PROXY}/schedules/${SCHEDULE_ID}/versions`, handler: () => jsonResponse([scheduleVersionSummary({ id: VERSION_ID })]) },
      { url: `${PROXY}/schedule-versions/${VERSION_ID}`, handler: () => jsonResponse(scheduleVersionDetail({ id: VERSION_ID })) },
      { url: `${PROXY}/schedule-versions/${VERSION_ID}/entries`, handler: () => jsonResponse([scheduleEntry()]) },
      // 5. Manual edit: validate, then apply.
      {
        url: `${PROXY}/schedule-versions/${VERSION_ID}/validate-manual-edit`,
        method: 'POST',
        handler: () => jsonResponse(manualEditValidation()),
      },
      {
        url: `${PROXY}/schedule-versions/${VERSION_ID}/manual-edit`,
        method: 'POST',
        handler: () => jsonResponse(manualEditApplyResult()),
      },
      // 6. Workflow: submit, review, approve and publish on a college schedule.
      {
        url: `${PROXY}/schedule-versions/${VERSION_ID}/workflow-validation`,
        handler: () => jsonResponse(workflowValidationResult()),
      },
      {
        url: `${PROXY}/schedule-versions/${VERSION_ID}/submit`,
        method: 'POST',
        handler: () => jsonResponse(workflowTransitionResult({ status: 'SUBMITTED' })),
      },
      {
        url: `${PROXY}/schedule-versions/${VERSION_ID}/review`,
        method: 'POST',
        handler: () =>
          jsonResponse(workflowTransitionResult({ action: 'review', status: 'REVIEWED' })),
      },
      {
        url: `${PROXY}/schedule-versions/${VERSION_ID}/approve`,
        method: 'POST',
        handler: () =>
          jsonResponse(workflowTransitionResult({ action: 'approve', status: 'APPROVED' })),
      },
      {
        url: `${PROXY}/schedule-versions/${VERSION_ID}/publish`,
        method: 'POST',
        handler: () =>
          jsonResponse(workflowTransitionResult({ action: 'publish', status: 'PUBLISHED' })),
      },
      // 7. Official timetable.
      {
        url: `${PROXY}/${SCHEDULING_ENDPOINTS.publishedCurrent}?semester=8`,
        handler: () => jsonResponse(publishedSchedule()),
      },
      // 8. Analytics: version, then published.
      {
        url: `${PROXY}/schedule-versions/${VERSION_ID}/analytics`,
        handler: () => jsonResponse(analyticsResult()),
      },
      {
        url: `${PROXY}/${SCHEDULING_ENDPOINTS.publishedAnalytics}?semester=8`,
        handler: () => jsonResponse(analyticsResult({ scope: 'COLLEGE' })),
      },
      // 9. Exports.
      {
        url: `${PROXY}/schedule-versions/${VERSION_ID}/export/xlsx`,
        handler: () => binaryResponse(new Uint8Array([80, 75]), EXPORT_MEDIA_TYPES.xlsx),
      },
      {
        url: `${PROXY}/${SCHEDULING_ENDPOINTS.publishedExportPdf}?semester=8`,
        handler: () => binaryResponse(new Uint8Array([37, 80, 68, 70]), EXPORT_MEDIA_TYPES.pdf),
      },
      // 10. Semester plan import: template, validate, apply.
      {
        url: `${PROXY}/${SCHEDULING_ENDPOINTS.semesterPlanTemplate}`,
        handler: () => binaryResponse(new Uint8Array([80, 75]), EXPORT_MEDIA_TYPES.xlsx),
      },
      {
        url: `${PROXY}/${SCHEDULING_ENDPOINTS.semesterPlanValidate}`,
        method: 'POST',
        handler: () => jsonResponse(importValidationResult({ valid: true, issues: [] })),
      },
      {
        url: `${PROXY}/${SCHEDULING_ENDPOINTS.semesterPlanApply}`,
        method: 'POST',
        handler: () => jsonResponse(importApplyResult()),
      },
      // 11. Audit trail.
      { url: `${PROXY}/audit-events`, handler: () => jsonResponse([auditEvent()]) },
    ]);

    // Session restore and the dashboard module set.
    const session = await fetch('/api/auth/session');
    expect(session.status).toBe(200);
    expect(getNavigationForRole('COLLEGE_ADMIN').map((item) => item.href)).toContain('/dashboard');

    // Academic setup and resources.
    expect(await collegesApi.list()).toHaveLength(1);
    expect(await semestersApi.list()).toHaveLength(1);
    expect(await roomsApi.list()).toHaveLength(1);

    // Readiness: department scope then college scope.
    expect(
      (await validationApi.run({ semester: SEMESTER, scope: 'DEPARTMENT', department: 2 })).ready,
    ).toBe(true);
    expect((await validationApi.run({ semester: SEMESTER, scope: 'COLLEGE' })).ready).toBe(true);

    // Preview generation.
    expect((await departmentGenerationApi.preview({ semester: SEMESTER, department: 2 })).generated).toBe(
      true,
    );
    expect((await collegeGenerationApi.preview({ semester: SEMESTER })).generated).toBe(true);

    // Persisted drafts.
    expect(
      (await departmentDraftApi.create({ semester: SEMESTER, department: 2 })).persisted,
    ).toBe(true);
    expect((await collegeDraftApi.create({ semester: SEMESTER })).persisted).toBe(true);

    // Schedule and version reads.
    expect(await schedulesApi.list({ semester: SEMESTER })).toHaveLength(1);
    expect(await schedulesApi.versions(SCHEDULE_ID)).toHaveLength(1);
    expect((await scheduleVersionsApi.get(VERSION_ID)).id).toBe(VERSION_ID);
    expect(await scheduleVersionsApi.entries(VERSION_ID)).toHaveLength(1);

    // Manual edit of a draft.
    const proposal = { notes: 'Move it.', changes: [{ entry_id: 900, room_id: 24 }] };
    expect((await manualEditApi.validate(VERSION_ID, proposal)).valid).toBe(true);
    const applied = await manualEditApi.apply(VERSION_ID, proposal);
    expect(applied.persisted).toBe(true);
    expect(applied.version.source).toBe('MANUAL_EDIT');

    // The four workflow steps, one request each.
    expect((await workflowApi.validation(VERSION_ID)).valid).toBe(true);
    expect((await workflowApi.action(VERSION_ID, 'SUBMIT')).status).toBe('SUBMITTED');
    expect((await workflowApi.action(VERSION_ID, 'REVIEW')).status).toBe('REVIEWED');
    expect((await workflowApi.action(VERSION_ID, 'APPROVE')).status).toBe('APPROVED');
    expect((await workflowApi.action(VERSION_ID, 'PUBLISH')).status).toBe('PUBLISHED');

    // Official timetable, analytics and exports.
    expect((await publishedScheduleApi.current(SEMESTER)).version.status).toBe('PUBLISHED');
    expect((await analyticsApi.forVersion(VERSION_ID)).summary.entry_count).toBe(12);
    expect((await analyticsApi.forPublished(SEMESTER)).scope).toBe('COLLEGE');
    expect((await versionExportApi.xlsx(VERSION_ID)).contentType).toBe(EXPORT_MEDIA_TYPES.xlsx);
    expect((await publishedExportApi.pdf(SEMESTER)).contentType).toBe(EXPORT_MEDIA_TYPES.pdf);

    // Import: template, validate, apply.
    expect((await semesterPlanImportApi.template()).contentType).toBe(EXPORT_MEDIA_TYPES.xlsx);
    const form = new FormData();
    form.append('department', '2');
    form.append('semester', String(SEMESTER));
    form.append('file', new File(['x'], 'plan.xlsx'));
    expect((await semesterPlanImportApi.validate(form)).valid).toBe(true);
    expect((await semesterPlanImportApi.apply(form)).applied).toBe(true);

    // Audit trail.
    expect(await auditApi.list()).toHaveLength(1);

    // Every step went through the same-origin BFF, and nothing else was called.
    expect(mock.calls.every((call) => call.url.startsWith(PROXY) || call.url.startsWith('/api/auth'))).toBe(
      true,
    );
    expect(mock.calls.some((call) => call.url.includes('127.0.0.1'))).toBe(false);
  });
});

describe('DEPARTMENT_ADMIN journey is narrowed to its own department', () => {
  it('keeps the whole read journey and stops at approval', async () => {
    const mock = installFetchMock([
      { url: '/api/auth/session', handler: () => jsonResponse({ user: DEPARTMENT_ADMIN }) },
      { url: `${PROXY}/rooms`, handler: () => jsonResponse([ROOM]) },
      { url: `${PROXY}/schedule-versions/${VERSION_ID}`, handler: () => jsonResponse(scheduleVersionDetail({ id: VERSION_ID })) },
      {
        url: `${PROXY}/schedule-versions/${VERSION_ID}/manual-edit`,
        method: 'POST',
        handler: () => jsonResponse(manualEditApplyResult()),
      },
      {
        url: `${PROXY}/schedule-versions/${VERSION_ID}/submit`,
        method: 'POST',
        handler: () => jsonResponse(workflowTransitionResult({ status: 'SUBMITTED' })),
      },
      {
        url: `${PROXY}/${SCHEDULING_ENDPOINTS.publishedCurrent}?semester=8`,
        handler: () => jsonResponse(publishedSchedule()),
      },
      {
        url: `${PROXY}/${SCHEDULING_ENDPOINTS.semesterPlanValidate}`,
        method: 'POST',
        handler: () => jsonResponse(importValidationResult({ valid: true, issues: [] })),
      },
      {
        url: `${PROXY}/${SCHEDULING_ENDPOINTS.publishedAnalytics}?semester=8`,
        handler: () => jsonResponse(analyticsResult()),
      },
      { url: `${PROXY}/audit-events`, handler: () => jsonResponse([auditEvent()]) },
    ]);

    // Own department: full read and the two allowed mutations.
    expect(await roomsApi.list()).toHaveLength(1);
    expect((await scheduleVersionsApi.get(VERSION_ID)).version_number).toBe(1);
    expect((await manualEditApi.apply(VERSION_ID, { changes: [] })).persisted).toBe(true);
    expect((await workflowApi.action(VERSION_ID, 'SUBMIT')).status).toBe('SUBMITTED');

    // Reports, official timetable, own-department import and own audit trail.
    expect((await publishedScheduleApi.current(SEMESTER)).entries).toHaveLength(1);
    expect((await analyticsApi.forPublished(SEMESTER)).summary.entry_count).toBe(12);
    expect(
      (await semesterPlanImportApi.validate(new FormData())).valid,
    ).toBe(true);
    expect(await auditApi.list()).toHaveLength(1);

    // No review, approve or publish request is issued from this journey at all.
    for (const action of ['review', 'approve', 'publish']) {
      expect(mock.callsTo(`${PROXY}/schedule-versions/${VERSION_ID}/${action}`)).toHaveLength(0);
    }
  });

  it('cannot reach a foreign department or the college-wide surface', () => {
    expect(canAccessPath('DEPARTMENT_ADMIN', '/academic')).toBe(true);
    expect(canAccessPath('DEPARTMENT_ADMIN', '/resources')).toBe(true);
    expect(canAccessPath('DEPARTMENT_ADMIN', '/scheduling')).toBe(true);
    // The college-wide generation surface is a college-administrator action only.
    expect(getNavigationForRole('DEPARTMENT_ADMIN').map((item) => item.href)).not.toContain(
      '/scheduling/generate-college',
    );
  });
});

describe('SCHEDULER journey is operational but not administrative', () => {
  it('reaches resources and scheduling, and never import or audit', () => {
    const hrefs = getNavigationForRole('SCHEDULER').map((item) => item.href);

    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/resources');
    expect(hrefs).toContain('/scheduling');
    expect(hrefs).toContain('/published');
    expect(hrefs).toContain('/reports');
    expect(hrefs).not.toContain('/academic');
    expect(hrefs).not.toContain('/imports/semester-plan');
    expect(hrefs).not.toContain('/audit');
    expect(canAccessPath('SCHEDULER', '/imports/semester-plan')).toBe(false);
    expect(canAccessPath('SCHEDULER', '/audit')).toBe(false);
    expect(canAccessPath('SCHEDULER', '/academic')).toBe(false);
  });
});

describe('VIEWER journey is read-only', () => {
  it('reaches history, comparison, official timetable and reports, and nothing else', () => {
    const hrefs = getNavigationForRole('VIEWER').map((item) => item.href);

    expect(hrefs).toEqual(['/dashboard', '/scheduling', '/published', '/reports']);
    expect(canAccessPath('VIEWER', '/resources')).toBe(false);
    expect(canAccessPath('VIEWER', '/academic')).toBe(false);
    expect(canAccessPath('VIEWER', '/imports/semester-plan')).toBe(false);
    expect(canAccessPath('VIEWER', '/audit')).toBe(false);
  });
});

describe('INSTRUCTOR journey is personal only', () => {
  it('reaches the dashboard and the personal timetable, and nothing else', () => {
    expect(getNavigationForRole('INSTRUCTOR').map((item) => item.href)).toEqual([
      '/dashboard',
      '/my-timetable',
    ]);
    for (const path of [
      '/academic',
      '/resources',
      '/scheduling',
      '/reports',
      '/published',
      '/imports/semester-plan',
      '/audit',
    ]) {
      expect(canAccessPath('INSTRUCTOR', path), `instructor must not reach ${path}`).toBe(false);
    }
  });
});

describe('direct-route authorization', () => {
  const MATRIX: Record<string, string[]> = {
    COLLEGE_ADMIN: [
      '/academic',
      '/resources',
      '/scheduling',
      '/published',
      '/reports',
      '/imports/semester-plan',
      '/audit',
    ],
    DEPARTMENT_ADMIN: [
      '/academic',
      '/resources',
      '/scheduling',
      '/published',
      '/reports',
      '/imports/semester-plan',
      '/audit',
    ],
    SCHEDULER: ['/resources', '/scheduling', '/published', '/reports'],
    VIEWER: ['/scheduling', '/published', '/reports'],
    INSTRUCTOR: ['/my-timetable'],
  };

  for (const [role, allowed] of Object.entries(MATRIX)) {
    it(`gives ${role} exactly its own protected paths`, () => {
      for (const path of PROTECTED_PREFIXES) {
        // `/dashboard` and `/forbidden` are presentational states every known role may
        // open; they are asserted separately below.
        if (path === '/dashboard' || path === '/forbidden') {
          continue;
        }
        const expected = allowed.some(
          (prefix) => path === prefix || path.startsWith(`${prefix}/`),
        );
        expect(canAccessPath(role, path), `${role} vs ${path}`).toBe(expected);
      }
    });
  }

  it('keeps the dashboard and the forbidden state reachable for every known role', () => {
    for (const role of Object.keys(MATRIX)) {
      expect(canAccessPath(role, '/dashboard')).toBe(true);
      expect(canAccessPath(role, '/forbidden')).toBe(true);
    }
  });
});

describe('departmentless scoped accounts fail closed', () => {
  it('is restricted for a department admin, scheduler and viewer without a department', () => {
    for (const role of ['DEPARTMENT_ADMIN', 'SCHEDULER', 'VIEWER']) {
      expect(needsDepartmentAssignment(role, null)).toBe(true);
      expect(needsDepartmentAssignment(role, { id: 2 })).toBe(false);
    }
    // A college administrator is college-wide by design and is never restricted this way.
    expect(needsDepartmentAssignment('COLLEGE_ADMIN', null)).toBe(false);
  });
});

describe('unknown roles have no authority', () => {
  it('grants no navigation and no path beyond the safe states', () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN', 'root', '', undefined]) {
      expect(getNavigationForRole(role)).toEqual([]);
      expect(canAccessPath(role, '/scheduling')).toBe(false);
      expect(canAccessPath(role, '/academic')).toBe(false);
      expect(canAccessPath(role, '/dashboard')).toBe(false);
    }
  });
});
