/**
 * Test fixtures for the F4 schedule-operations, reporting, import and audit module.
 *
 * Tests only: no application code imports this file, so no invented analytics,
 * publication, import result or audit event can reach the production UI.
 */

import type { IssueDetails } from '@/lib/scheduling/types';
import type {
  AnalyticsDepartmentLoad,
  AnalyticsDepartmentScope,
  AnalyticsInstructorWorkload,
  AnalyticsQuality,
  AnalyticsRoomUsage,
  AnalyticsStudentGroupLoad,
  AuditEvent,
  ImportIssue,
  ManualEditApplyResult,
  ManualEditValidationResult,
  PublishedScheduleResult,
  ScheduleAnalyticsResult,
  SemesterPlanApplyResult,
  SemesterPlanValidationResult,
  WorkflowTransitionResult,
  WorkflowValidationResult,
} from '@/lib/scheduling/types';

import { BIOAI_DEPARTMENT, SEMESTER_SUMMARY, scheduleEntry, scheduleVersionDetail } from './scheduling-fixtures';

const TIMESTAMP = '2026-09-21T12:00:00Z';

// --- Manual editing -------------------------------------------------------

export function manualEditValidation(
  overrides: Partial<ManualEditValidationResult> = {},
): ManualEditValidationResult {
  return {
    valid: true,
    base_version: 501,
    summary: { changes: 1, errors: 0 },
    issues: [],
    ...overrides,
  };
}

export function manualEditApplyResult(
  overrides: Partial<ManualEditApplyResult> = {},
): ManualEditApplyResult {
  return {
    persisted: true,
    schedule: 300,
    base_version: 501,
    version: {
      id: 502,
      version_number: 2,
      status: 'DRAFT',
      source: 'MANUAL_EDIT',
      parent_version: 501,
    },
    summary: { entries: 12, changed_entries: 1 },
    ...overrides,
  };
}

// --- Workflow -------------------------------------------------------------

export function workflowValidationResult(
  overrides: Partial<WorkflowValidationResult> = {},
): WorkflowValidationResult {
  return {
    valid: true,
    version: 501,
    status: 'DRAFT',
    summary: { entries: 12, errors: 0 },
    issues: [],
    ...overrides,
  };
}

export function workflowTransitionResult(
  overrides: Partial<WorkflowTransitionResult> = {},
): WorkflowTransitionResult {
  return {
    applied: true,
    action: 'submit',
    status: 'SUBMITTED',
    from_status: 'DRAFT',
    version: scheduleVersionDetail({ status: 'SUBMITTED' }),
    validation: null,
    ...overrides,
  };
}

// --- Official timetable ---------------------------------------------------

export function publishedSchedule(
  overrides: Partial<PublishedScheduleResult> = {},
): PublishedScheduleResult {
  return {
    semester: SEMESTER_SUMMARY,
    schedule: {
      id: 300,
      scope: 'DEPARTMENT',
      semester: SEMESTER_SUMMARY,
      department: BIOAI_DEPARTMENT,
    },
    version: {
      id: 601,
      version_number: 3,
      status: 'PUBLISHED',
      published_at: TIMESTAMP,
      published_by: { id: 7, username: 'r.salim', role: 'COLLEGE_ADMIN' },
    },
    entries: [scheduleEntry()],
    ...overrides,
  };
}

// --- Analytics ------------------------------------------------------------

export function analyticsSummary(overrides: Partial<ScheduleAnalyticsResult['summary']> = {}) {
  return {
    entry_count: 12,
    session_count: 10,
    scheduled_minutes: 720,
    scheduled_hours: 12,
    unique_courses: 4,
    unique_teaching_components: 5,
    unique_departments: 2,
    unique_instructors: 6,
    unique_rooms: 3,
    unique_student_groups: 4,
    days_used: 5,
    ...overrides,
  };
}

export function departmentScope(
  overrides: Partial<AnalyticsDepartmentScope> = {},
): AnalyticsDepartmentScope {
  return {
    department: BIOAI_DEPARTMENT,
    managed_session_count: 8,
    participating_session_count: 2,
    total_visible_session_count: 10,
    managed_minutes: 480,
    managed_hours: 8,
    participating_minutes: 120,
    participating_hours: 2,
    ...overrides,
  };
}

export function departmentLoad(
  overrides: Partial<AnalyticsDepartmentLoad> = {},
): AnalyticsDepartmentLoad {
  return {
    department: BIOAI_DEPARTMENT,
    component_count: 5,
    session_count: 8,
    scheduled_minutes: 480,
    scheduled_hours: 8,
    unique_courses: 3,
    unique_instructors: 4,
    unique_rooms: 2,
    unique_student_groups: 3,
    joint_session_count: 1,
    ...overrides,
  };
}

export function instructorWorkload(
  overrides: Partial<AnalyticsInstructorWorkload> = {},
): AnalyticsInstructorWorkload {
  return {
    instructor: { id: 1, name: 'Rana Salim' },
    session_count: 6,
    primary_session_count: 5,
    assistant_session_count: 1,
    scheduled_minutes: 360,
    scheduled_hours: 6,
    days_used: 4,
    max_daily_scheduled_minutes: 180,
    max_daily_scheduled_hours: 3,
    department_count: 2,
    department_ids: [2, 99],
    department_codes: ['BIOAI', 'CS'],
    total_gap_minutes: 60,
    average_gap_minutes_per_active_day: 15,
    max_gap_minutes: 30,
    ...overrides,
  };
}

export function roomUsage(overrides: Partial<AnalyticsRoomUsage> = {}): AnalyticsRoomUsage {
  return {
    room: { id: 22, code: 'AI-LAB-1', name: 'Artificial Intelligence Lab' },
    session_count: 4,
    occupied_minutes: 240,
    occupied_hours: 4,
    occupied_slot_count: 4,
    days_used: 3,
    utilization_basis: 'CURRENT_GRID_IN_USE_DAYS',
    available_minutes: 600,
    available_hours: 10,
    utilization_percent: 40,
    configuration_mismatch: false,
    ...overrides,
  };
}

export function studentGroupLoad(
  overrides: Partial<AnalyticsStudentGroupLoad> = {},
): AnalyticsStudentGroupLoad {
  return {
    group: { id: 40, code: 'BIOAI-1', name: 'Biomedical AI Year 1' },
    department: BIOAI_DEPARTMENT,
    session_count: 5,
    scheduled_minutes: 300,
    scheduled_hours: 5,
    days_used: 3,
    managing_department_count: 2,
    total_gap_minutes: 45,
    average_gap_minutes_per_active_day: 15,
    max_gap_minutes: 20,
    ...overrides,
  };
}

export function analyticsQuality(overrides: Partial<AnalyticsQuality> = {}): AnalyticsQuality {
  return {
    total_preference_penalty: 42,
    average_preference_penalty_per_session: 4.2,
    total_instructor_gap_minutes: 60,
    average_instructor_gap_minutes: 15,
    total_student_group_gap_minutes: 45,
    average_student_group_gap_minutes: 15,
    sessions_by_weekday: { '0': 3, '1': 4, '2': 3 },
    sessions_by_start_hour: { '8': 4, '10': 6 },
    max_sessions_for_one_instructor_day: 3,
    max_sessions_for_one_group_day: 4,
    ...overrides,
  };
}

export function analyticsResult(
  overrides: Partial<ScheduleAnalyticsResult> = {},
): ScheduleAnalyticsResult {
  return {
    scope: 'DEPARTMENT',
    version: {
      schedule_id: 300,
      scope: 'DEPARTMENT',
      semester_id: 8,
      semester_label: 'Semester 1 · 2026–2027',
      id: 501,
      version_number: 1,
      status: 'DRAFT',
      source: 'DEPARTMENT_GENERATION',
      created_at: TIMESTAMP,
      published_at: null,
      published_by: null,
    },
    summary: analyticsSummary(),
    department_scope: null,
    department_load: [departmentLoad()],
    instructor_workload: [instructorWorkload()],
    room_utilization: [roomUsage()],
    student_group_load: [studentGroupLoad()],
    quality: analyticsQuality(),
    ...overrides,
  };
}

// --- Import ---------------------------------------------------------------

export function importIssue(overrides: Partial<ImportIssue> = {}): ImportIssue {
  return {
    sheet: 'courses',
    row: 4,
    column: 'code',
    code: 'DUPLICATE_COURSE_CODE',
    severity: 'ERROR',
    message: 'The course code ML301 appears twice in this workbook.',
    details: { code: 'ML301' },
    ...overrides,
  };
}

export function importValidationResult(
  overrides: Partial<SemesterPlanValidationResult> = {},
): SemesterPlanValidationResult {
  return {
    valid: false,
    summary: { sheets: 6, rows: 24, errors: 1, warnings: 2 },
    issues: [importIssue()],
    ...overrides,
  };
}

export function importApplyResult(
  overrides: Partial<SemesterPlanApplyResult> = {},
): SemesterPlanApplyResult {
  return {
    applied: true,
    department: { id: BIOAI_DEPARTMENT.id, code: 'BIOAI', name: 'Biomedical AI' },
    semester: { id: 8, number: 1, academic_year: '2026-2027' },
    created: {
      courses: 3,
      student_groups: 2,
      offerings: 4,
      components: 5,
      component_group_links: 5,
      teaching_assignments: 6,
      room_requirements: 4,
      requirement_capabilities: 2,
    },
    warnings: [
      importIssue({
        severity: 'WARNING',
        code: 'GROUP_WITHOUT_STAGE',
        message: 'A student group has no study stage.',
      }),
    ],
    summary: { sheets: 6, rows: 24, errors: 0, warnings: 1 },
    issues: [],
    ...overrides,
  };
}

// --- Audit ----------------------------------------------------------------

export function auditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: '0f5b2c1e-7a4d-4f6e-9c8b-1d2e3f4a5b6c',
    created_at: TIMESTAMP,
    action: 'MANUAL_EDIT_APPLIED',
    actor: { id: 7, username_snapshot: 'r.salim', role_snapshot: 'SCHEDULER' },
    department: BIOAI_DEPARTMENT,
    semester: SEMESTER_SUMMARY,
    schedule: { id: 300, scope: 'DEPARTMENT', semester_id: 8, department_id: 2 },
    schedule_version: { id: 502, version_number: 2, status: 'DRAFT', source: 'MANUAL_EDIT' },
    object_type: 'ScheduleVersion',
    object_id: '502',
    request_id: 'req-9f0f6e3e',
    metadata: { changed_entries: 1, base_version: 501 } as IssueDetails,
    ...overrides,
  };
}
