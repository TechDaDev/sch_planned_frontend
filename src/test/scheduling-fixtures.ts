/**
 * Test fixtures for the F3 scheduling module.
 *
 * Tests only: no application code imports this file, so no invented schedule,
 * solver or timetable data can reach the production UI.
 */

import type {
  CollegeGenerationPlacement,
  CollegeGenerationResult,
  DepartmentGenerationResult,
  GenerationPlacement,
  GenerationRejectedResult,
  PreSchedulingValidationResult,
  ScheduleDetail,
  ScheduleEntry,
  ScheduleSummary,
  ScheduleVersionDetail,
  ScheduleVersionSummary,
  ValidationIssue,
  ValidationSemester,
} from '@/lib/scheduling/types';
import type { AcademicCapabilityUser } from '@/lib/academic/permissions';

const TIMESTAMP = '2026-09-01T08:00:00Z';

export const BIOAI_DEPARTMENT = { id: 2, name: 'Biomedical AI', code: 'BIOAI' };
export const CS_DEPARTMENT = { id: 99, name: 'Computer Science', code: 'CS' };

export const VALIDATION_SEMESTER: ValidationSemester = {
  id: 8,
  number: 1,
  academic_year: '2026-2027',
  academic_year_id: 3,
};

/** Semester summary as the schedule read API nests it. */
export const SEMESTER_SUMMARY = {
  id: 8,
  number: 1 as const,
  academic_year: { id: 3, start_year: 2026, end_year: 2027 },
};

export function validationIssue(overrides: Partial<ValidationIssue> = {}): ValidationIssue {
  return {
    code: 'INSTRUCTOR_HOURS_EXCEEDED',
    severity: 'ERROR',
    message: 'Rana Salim is assigned more hours than the maximum weekly load.',
    entity_type: 'InstructorProfile',
    entity_id: 1,
    details: { assigned_hours: '21.00', max_weekly_hours: '18.00', instructor: 'Rana Salim' },
    ...overrides,
  };
}

export function validationResult(
  overrides: Partial<PreSchedulingValidationResult> = {},
): PreSchedulingValidationResult {
  return {
    ready: false,
    scope: 'DEPARTMENT',
    semester: VALIDATION_SEMESTER,
    department: BIOAI_DEPARTMENT,
    summary: { components_checked: 12, errors: 1, warnings: 0 },
    issues: [validationIssue()],
    ...overrides,
  };
}

export function placement(overrides: Partial<GenerationPlacement> = {}): GenerationPlacement {
  return {
    session_id: 'tc-10#s1',
    course: { id: 7, code: 'ML301', name: 'Machine Learning' },
    offering: { id: 9, offering_code: 'MAIN' },
    teaching_component: { id: 10, component_type: 'THEORY', label: 'Lecture A' },
    day_of_week: 0,
    day_display: 'Sunday',
    slots: [
      {
        id: 31,
        sequence: 1,
        label: 'Period 1',
        start_time: '08:00',
        end_time: '09:00',
      },
      {
        id: 32,
        sequence: 2,
        label: 'Period 2',
        start_time: '09:00',
        end_time: '10:00',
      },
    ],
    start_time: '08:00',
    end_time: '10:00',
    room: { id: 22, code: 'AI-LAB-1', name: 'Artificial Intelligence Lab' },
    instructors: [{ id: 1, full_name: 'Rana Salim', assignment_role: 'PRIMARY' }],
    student_groups: [{ id: 40, code: 'BIOAI-1', name: 'Biomedical AI Year 1' }],
    penalty: 4,
    ...overrides,
  };
}

export function collegePlacement(
  overrides: Partial<CollegeGenerationPlacement> = {},
): CollegeGenerationPlacement {
  return {
    ...placement(),
    managing_department: BIOAI_DEPARTMENT,
    ...overrides,
  };
}

export function departmentGenerationResult(
  overrides: Partial<DepartmentGenerationResult> = {},
): DepartmentGenerationResult {
  return {
    generated: true,
    persisted: false,
    message: 'Solved.',
    semester: VALIDATION_SEMESTER,
    department: BIOAI_DEPARTMENT,
    validation: validationResult({ ready: true, summary: { components_checked: 12, errors: 0, warnings: 1 }, issues: [] }),
    solver: {
      status: 'FEASIBLE',
      objective_value: 128,
      wall_time_seconds: 3.5,
      num_conflicts: 42,
      num_branches: 1200,
      message: '',
    },
    summary: { components: 6, sessions: 12, candidates: 480, placements: 12 },
    placements: [placement()],
    generation_issues: [],
    diagnostics: {
      components: 6,
      sessions: 12,
      candidates: 480,
      min_candidates_per_session: 12,
      max_candidates_per_session: 96,
      sessions_with_fewest_candidates: [
        { session_id: 'tc-10#s1', component_id: 10, candidate_count: 12 },
      ],
      sessions_without_candidates: [],
    },
    ...overrides,
  };
}

export function collegeGenerationResult(
  overrides: Partial<CollegeGenerationResult> = {},
): CollegeGenerationResult {
  return {
    generated: true,
    persisted: false,
    scope: 'COLLEGE',
    message: 'Solved.',
    semester: VALIDATION_SEMESTER,
    validation: validationResult({
      scope: 'COLLEGE',
      department: null,
      ready: true,
      summary: { components_checked: 40, errors: 0, warnings: 2 },
      issues: [],
    }),
    solver: {
      status: 'OPTIMAL',
      objective_value: 512,
      wall_time_seconds: 61.25,
      num_conflicts: 310,
      num_branches: 5400,
    },
    summary: { departments: 2, components: 18, sessions: 44, candidates: 2100, placements: 44 },
    department_summaries: [
      {
        department: BIOAI_DEPARTMENT,
        components: 10,
        sessions: 24,
        candidates: 1200,
        placements: 24,
      },
      {
        department: CS_DEPARTMENT,
        components: 8,
        sessions: 20,
        candidates: 900,
        placements: 20,
      },
    ],
    placements: [collegePlacement()],
    generation_issues: [],
    diagnostics: {
      components: 18,
      sessions: 44,
      candidates: 2100,
      min_candidates_per_session: 8,
      max_candidates_per_session: 120,
      sessions_with_fewest_candidates: [],
      sessions_without_candidates: [],
      departments: 2,
      department_breakdown: [
        { department: BIOAI_DEPARTMENT, components: 10, sessions: 24, candidates: 1200 },
        { department: CS_DEPARTMENT, components: 8, sessions: 20, candidates: 900 },
      ],
    },
    ...overrides,
  };
}

export function generationRejection(
  overrides: Partial<GenerationRejectedResult> = {},
): GenerationRejectedResult {
  return {
    generated: false,
    persisted: false,
    reason: 'PRE_SCHEDULING_VALIDATION_FAILED',
    message: 'Readiness validation reported blocking errors.',
    semester: VALIDATION_SEMESTER,
    department: BIOAI_DEPARTMENT,
    validation: validationResult(),
    generation_issues: [],
    diagnostics: null,
    ...overrides,
  };
}

export function scheduleVersionSummary(
  overrides: Partial<ScheduleVersionSummary> = {},
): ScheduleVersionSummary {
  return {
    id: 501,
    version_number: 1,
    status: 'DRAFT',
    source: 'DEPARTMENT_GENERATION',
    parent_version: null,
    created_by: { id: 7, username: 'r.salim', role: 'SCHEDULER' },
    notes: 'First draft',
    solver_status: 'FEASIBLE',
    objective_value: 128,
    entry_count: 12,
    created_at: TIMESTAMP,
    ...overrides,
  };
}

export function scheduleSummary(overrides: Partial<ScheduleSummary> = {}): ScheduleSummary {
  return {
    id: 300,
    scope: 'DEPARTMENT',
    semester: SEMESTER_SUMMARY,
    department: BIOAI_DEPARTMENT,
    version_count: 2,
    latest_version_number: 2,
    latest_version_status: 'DRAFT',
    created_at: TIMESTAMP,
    updated_at: '2026-09-02T10:15:00Z',
    ...overrides,
  };
}

export function scheduleDetail(overrides: Partial<ScheduleDetail> = {}): ScheduleDetail {
  return {
    ...scheduleSummary(),
    latest_version: scheduleVersionSummary({ id: 502, version_number: 2 }),
    published_version: null,
    published_version_number: null,
    published_at: null,
    ...overrides,
  };
}

export function scheduleVersionDetail(
  overrides: Partial<ScheduleVersionDetail> = {},
): ScheduleVersionDetail {
  return {
    ...scheduleVersionSummary(),
    schedule: {
      id: 300,
      scope: 'DEPARTMENT',
      semester: SEMESTER_SUMMARY,
      department: BIOAI_DEPARTMENT,
    },
    solver_wall_time_seconds: 3.5,
    solver_num_conflicts: 42,
    solver_num_branches: 1200,
    validation_summary: { components_checked: 6, errors: 0, warnings: 1 },
    generation_summary: { components: 6, sessions: 12, candidates: 480, placements: 12 },
    submitted_by: null,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    approved_by: null,
    approved_at: null,
    published_by: null,
    published_at: null,
    is_published_current: false,
    ...overrides,
  };
}

/**
 * One persisted entry.
 *
 * The snapshot columns deliberately differ from any live academic or resource
 * value, so a test can prove that the version view shows what was stored.
 */
export function scheduleEntry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: 900,
    session_id: 'tc-10#s1',
    candidate_id: 'cand-77',
    session_ordinal: 1,
    course: { id: 7, code: 'ML301', name: 'Machine Learning (stored snapshot)' },
    offering: { id: 9, offering_code: 'MAIN' },
    teaching_component: { id: 10, component_type: 'THEORY', label: 'Lecture A' },
    managing_department: BIOAI_DEPARTMENT,
    day_of_week: 1,
    day_display: 'Monday',
    start_time: '09:00',
    end_time: '11:00',
    time_slots: [
      {
        id: 31,
        position: 1,
        sequence: 1,
        label: 'Period 1',
        start_time: '09:00',
        end_time: '10:00',
      },
      {
        id: 32,
        position: 2,
        sequence: 2,
        label: 'Period 2',
        start_time: '10:00',
        end_time: '11:00',
      },
    ],
    room: { id: 22, code: 'AI-LAB-1', name: 'Artificial Intelligence Lab (stored snapshot)' },
    instructors: [{ id: 1, full_name: 'Rana Salim (stored snapshot)', assignment_role: 'PRIMARY' }],
    student_groups: [
      {
        id: 40,
        code: 'BIOAI-1',
        name: 'Biomedical AI Year 1',
        department: BIOAI_DEPARTMENT,
      },
    ],
    penalty: 4,
    ...overrides,
  };
}

// --- Capability users -----------------------------------------------------

export function schedulingUser(
  overrides: Partial<AcademicCapabilityUser> = {},
): AcademicCapabilityUser {
  return { role: 'COLLEGE_ADMIN', department: null, ...overrides };
}

export const schedulingCollegeAdmin = schedulingUser({ role: 'COLLEGE_ADMIN', department: null });
export const schedulingDepartmentAdmin = schedulingUser({
  role: 'DEPARTMENT_ADMIN',
  department: { id: BIOAI_DEPARTMENT.id },
});
export const schedulingOtherDepartmentAdmin = schedulingUser({
  role: 'DEPARTMENT_ADMIN',
  department: { id: CS_DEPARTMENT.id },
});
export const schedulingScheduler = schedulingUser({
  role: 'SCHEDULER',
  department: { id: BIOAI_DEPARTMENT.id },
});
export const schedulingViewer = schedulingUser({
  role: 'VIEWER',
  department: { id: BIOAI_DEPARTMENT.id },
});
export const schedulingInstructor = schedulingUser({
  role: 'INSTRUCTOR',
  department: { id: BIOAI_DEPARTMENT.id },
});
export const schedulingUnassignedAdmin = schedulingUser({
  role: 'DEPARTMENT_ADMIN',
  department: null,
});
export const schedulingUnassignedScheduler = schedulingUser({
  role: 'SCHEDULER',
  department: null,
});
