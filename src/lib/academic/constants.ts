/**
 * Academic constants: backend enum values, their display labels and routes.
 *
 * Values are never translated before being sent to the backend. Labels exist for
 * presentation only, so a display string can never leak into a write payload.
 */

import type { SemesterNumber, StudyType, TeachingComponentType } from '@/lib/academic/types';

export interface Option<TValue extends string> {
  value: TValue;
  label: string;
}

export const STUDY_TYPE_OPTIONS: readonly Option<StudyType>[] = [
  { value: 'UNDERGRADUATE', label: 'Undergraduate' },
  { value: 'MASTER', label: 'Master' },
  { value: 'PHD', label: 'PhD' },
];

export const TEACHING_COMPONENT_TYPE_OPTIONS: readonly Option<TeachingComponentType>[] = [
  { value: 'THEORY', label: 'Theory' },
  { value: 'PRACTICAL', label: 'Practical' },
];

export const SEMESTER_NUMBER_OPTIONS: readonly Option<string>[] = [
  { value: '1', label: 'First' },
  { value: '2', label: 'Second' },
];

export const STUDY_TYPE_LABELS: Record<StudyType, string> = {
  UNDERGRADUATE: 'Undergraduate',
  MASTER: 'Master',
  PHD: 'PhD',
};

export const TEACHING_COMPONENT_TYPE_LABELS: Record<TeachingComponentType, string> = {
  THEORY: 'Theory',
  PRACTICAL: 'Practical',
};

export const SEMESTER_NUMBER_LABELS: Record<SemesterNumber, string> = {
  1: 'First',
  2: 'Second',
};

export function studyTypeLabel(value: StudyType): string {
  return STUDY_TYPE_LABELS[value] ?? value;
}

export function componentTypeLabel(value: TeachingComponentType): string {
  return TEACHING_COMPONENT_TYPE_LABELS[value] ?? value;
}

export function semesterNumberLabel(value: SemesterNumber): string {
  return SEMESTER_NUMBER_LABELS[value] ?? String(value);
}

/** Academic administration routes. */
export const ACADEMIC_ROUTES = {
  overview: '/academic',
  colleges: '/academic/colleges',
  departments: '/academic/departments',
  academicYears: '/academic/academic-years',
  semesters: '/academic/semesters',
  programs: '/academic/programs',
  stages: '/academic/stages',
  studentGroups: '/academic/student-groups',
  courses: '/academic/courses',
  courseOfferings: '/academic/course-offerings',
  teachingComponents: '/academic/teaching-components',
  componentGroups: '/academic/component-groups',
} as const;

/** Roles that may open the Academic Administration module at all. */
export const ACADEMIC_ADMIN_ROLES = ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'] as const;

/** Copy used for deactivation, which never means deletion. */
export const DEACTIVATION_NOTICE =
  'This does not delete the record. It marks it inactive.';
