/**
 * Test fixtures for the academic module.
 *
 * These exist for tests only: nothing in `src/components` or `src/app` imports
 * this file, so no invented academic data can reach the production UI.
 */

import type { AcademicCapabilityUser } from '@/lib/academic/permissions';
import type {
  AcademicYear,
  AcademicYearSummary,
  College,
  CollegeSummary,
  Course,
  CourseOffering,
  CourseSummary,
  Department,
  DepartmentSummary,
  Semester,
  SemesterSummary,
  StudentGroup,
  StudentGroupSummary,
  StudyProgram,
  StudyProgramSummary,
  StudyStage,
  StudyStageSummary,
  TeachingComponent,
  TeachingComponentGroup,
  TeachingComponentSummary,
} from '@/lib/academic/types';

const TIMESTAMP = '2026-09-01T08:00:00Z';

export function collegeSummary(overrides: Partial<CollegeSummary> = {}): CollegeSummary {
  return { id: 1, name: 'College of Artificial Intelligence', code: 'AI', ...overrides };
}

export function departmentSummary(
  overrides: Partial<DepartmentSummary> = {},
): DepartmentSummary {
  return { id: 2, name: 'Biomedical AI', code: 'BIOAI', ...overrides };
}

export function academicYearSummary(
  overrides: Partial<AcademicYearSummary> = {},
): AcademicYearSummary {
  return { id: 3, start_year: 2026, end_year: 2027, ...overrides };
}

export function programSummary(
  overrides: Partial<StudyProgramSummary> = {},
): StudyProgramSummary {
  return { id: 4, name: 'Biomedical AI', code: 'BIOAI', study_type: 'UNDERGRADUATE', ...overrides };
}

export function stageSummary(overrides: Partial<StudyStageSummary> = {}): StudyStageSummary {
  return { id: 5, number: 2, name: 'Stage 2', ...overrides };
}

export function groupSummary(overrides: Partial<StudentGroupSummary> = {}): StudentGroupSummary {
  return { id: 6, name: 'Group A', code: 'A', ...overrides };
}

export function courseSummary(overrides: Partial<CourseSummary> = {}): CourseSummary {
  return { id: 7, name: 'Machine Learning', code: 'ML301', ...overrides };
}

export function semesterSummary(overrides: Partial<SemesterSummary> = {}): SemesterSummary {
  return { id: 8, number: 1, academic_year: academicYearSummary(), ...overrides };
}

export function componentSummary(
  overrides: Partial<TeachingComponentSummary> = {},
): TeachingComponentSummary {
  return { id: 10, component_type: 'THEORY', label: 'Lecture A', ...overrides };
}

export function collegeRow(overrides: Partial<College> = {}): College {
  return {
    id: 1,
    name: 'College of Artificial Intelligence',
    code: 'AI',
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function departmentRow(overrides: Partial<Department> = {}): Department {
  return {
    id: 2,
    name: 'Biomedical AI',
    code: 'BIOAI',
    college: collegeSummary(),
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function academicYearRow(overrides: Partial<AcademicYear> = {}): AcademicYear {
  return {
    id: 3,
    start_year: 2026,
    end_year: 2027,
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function semesterRow(overrides: Partial<Semester> = {}): Semester {
  return {
    id: 8,
    number: 1,
    start_date: '2026-09-01',
    end_date: '2027-01-15',
    academic_year: academicYearSummary(),
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function programRow(overrides: Partial<StudyProgram> = {}): StudyProgram {
  return {
    id: 4,
    name: 'Biomedical AI',
    code: 'BIOAI',
    study_type: 'UNDERGRADUATE',
    department: departmentSummary(),
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function stageRow(overrides: Partial<StudyStage> = {}): StudyStage {
  return {
    id: 5,
    number: 2,
    name: 'Stage 2',
    program: programSummary(),
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function studentGroupRow(overrides: Partial<StudentGroup> = {}): StudentGroup {
  return {
    id: 6,
    name: 'Group A',
    code: 'A',
    student_count: 42,
    stage: stageSummary(),
    parent_group: null,
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function courseRow(overrides: Partial<Course> = {}): Course {
  return {
    id: 7,
    name: 'Machine Learning',
    code: 'ML301',
    description: 'Supervised learning foundations.',
    department: departmentSummary(),
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function courseOfferingRow(
  overrides: Partial<CourseOffering> = {},
): CourseOffering {
  return {
    id: 9,
    offering_code: 'MAIN',
    course: courseSummary(),
    semester: semesterSummary(),
    managing_department: departmentSummary(),
    total_weekly_hours: '4.50',
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function teachingComponentRow(
  overrides: Partial<TeachingComponent> = {},
): TeachingComponent {
  return {
    id: 10,
    component_type: 'THEORY',
    label: 'Lecture A',
    weekly_hours: '3.00',
    session_duration_hours: '1.50',
    sessions_per_week: 2,
    offering: {
      id: 9,
      offering_code: 'MAIN',
      course: courseSummary(),
    },
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function componentGroupRow(
  overrides: Partial<TeachingComponentGroup> = {},
): TeachingComponentGroup {
  return {
    id: 11,
    teaching_component: componentSummary(),
    student_group: groupSummary(),
    created_at: TIMESTAMP,
    ...overrides,
  };
}

// --- Capability users -----------------------------------------------------

export function capabilityUser(
  overrides: Partial<AcademicCapabilityUser> = {},
): AcademicCapabilityUser {
  return { role: 'COLLEGE_ADMIN', department: null, ...overrides };
}

export const collegeAdmin: AcademicCapabilityUser = capabilityUser({
  role: 'COLLEGE_ADMIN',
  department: null,
});

export const departmentAdmin: AcademicCapabilityUser = capabilityUser({
  role: 'DEPARTMENT_ADMIN',
  department: { id: 2 },
});

export const otherDepartmentAdmin: AcademicCapabilityUser = capabilityUser({
  role: 'DEPARTMENT_ADMIN',
  department: { id: 99 },
});

export const unassignedDepartmentAdmin: AcademicCapabilityUser = capabilityUser({
  role: 'DEPARTMENT_ADMIN',
  department: null,
});

export const scheduler: AcademicCapabilityUser = capabilityUser({
  role: 'SCHEDULER',
  department: { id: 2 },
});

export const viewer: AcademicCapabilityUser = capabilityUser({
  role: 'VIEWER',
  department: { id: 2 },
});

export const instructor: AcademicCapabilityUser = capabilityUser({
  role: 'INSTRUCTOR',
  department: { id: 2 },
});
