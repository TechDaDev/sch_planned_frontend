/**
 * Academic API layer.
 *
 * Every call goes through the F0 browser client, which targets the same-origin
 * BFF (`/api/backend/...`). No component in this module knows about the backend
 * host, the token, or the Authorization header.
 *
 * The academic API has no hard delete: this module deliberately exposes no
 * delete helper (the backend answers HTTP 405 for `DELETE`).
 */

import {
  collectionPath,
  createRecord,
  getRecord,
  listCollection,
  patchRecord,
} from '@/lib/api/resource';
import type {
  AcademicYear,
  AcademicYearWrite,
  College,
  CollegeWrite,
  Course,
  CourseOffering,
  CourseOfferingWrite,
  CourseWrite,
  Department,
  DepartmentWrite,
  Semester,
  SemesterWrite,
  StudentGroup,
  StudentGroupWrite,
  StudyProgram,
  StudyProgramWrite,
  StudyStage,
  StudyStageWrite,
  TeachingComponent,
  TeachingComponentGroup,
  TeachingComponentGroupWrite,
  TeachingComponentWrite,
} from '@/lib/academic/types';

/** Backend endpoint segments, relative to the `/api/` prefix. */
export const ACADEMIC_ENDPOINTS = {
  colleges: 'colleges',
  departments: 'departments',
  academicYears: 'academic-years',
  semesters: 'semesters',
  programs: 'programs',
  stages: 'stages',
  studentGroups: 'student-groups',
  courses: 'courses',
  courseOfferings: 'course-offerings',
  teachingComponents: 'teaching-components',
  teachingComponentGroups: 'teaching-component-groups',
} as const;

export type AcademicEndpoint =
  (typeof ACADEMIC_ENDPOINTS)[keyof typeof ACADEMIC_ENDPOINTS];

/** Join an endpoint and an optional primary key into a proxy-relative path. */
export function resourcePath(endpoint: AcademicEndpoint, id?: number): string {
  return collectionPath(endpoint, id);
}

/** Fetch a collection (unpaginated array). */
export function listResource<T>(
  endpoint: AcademicEndpoint,
  signal?: AbortSignal,
): Promise<T[]> {
  return listCollection<T>(endpoint, { signal });
}

export function getResource<T>(
  endpoint: AcademicEndpoint,
  id: number,
  signal?: AbortSignal,
): Promise<T> {
  return getRecord<T>(endpoint, id, signal);
}

export function createResource<TRead>(
  endpoint: AcademicEndpoint,
  payload: unknown,
  signal?: AbortSignal,
): Promise<TRead> {
  return createRecord<TRead>(endpoint, payload, signal);
}

/**
 * Update an existing record.
 *
 * `PATCH` is used for both full-form edits and status changes: the backend's
 * write serializers declare required foreign keys (a department always needs a
 * college), and partial updates keep small edits from demanding fields the user
 * did not touch.
 */
export function patchResource<TRead>(
  endpoint: AcademicEndpoint,
  id: number,
  payload: unknown,
  signal?: AbortSignal,
): Promise<TRead> {
  return patchRecord<TRead>(endpoint, id, payload, signal);
}

// --- Typed helpers --------------------------------------------------------
// Thin wrappers keep the endpoint and the read type paired at the call site.

export const collegesApi = {
  list: (signal?: AbortSignal) => listResource<College>(ACADEMIC_ENDPOINTS.colleges, signal),
  create: (payload: CollegeWrite, signal?: AbortSignal) =>
    createResource<College>(ACADEMIC_ENDPOINTS.colleges, payload, signal),
  update: (id: number, payload: Partial<CollegeWrite>, signal?: AbortSignal) =>
    patchResource<College>(ACADEMIC_ENDPOINTS.colleges, id, payload, signal),
};

export const departmentsApi = {
  list: (signal?: AbortSignal) =>
    listResource<Department>(ACADEMIC_ENDPOINTS.departments, signal),
  create: (payload: DepartmentWrite, signal?: AbortSignal) =>
    createResource<Department>(ACADEMIC_ENDPOINTS.departments, payload, signal),
  update: (id: number, payload: Partial<DepartmentWrite>, signal?: AbortSignal) =>
    patchResource<Department>(ACADEMIC_ENDPOINTS.departments, id, payload, signal),
};

export const academicYearsApi = {
  list: (signal?: AbortSignal) =>
    listResource<AcademicYear>(ACADEMIC_ENDPOINTS.academicYears, signal),
  create: (payload: AcademicYearWrite, signal?: AbortSignal) =>
    createResource<AcademicYear>(ACADEMIC_ENDPOINTS.academicYears, payload, signal),
  update: (id: number, payload: Partial<AcademicYearWrite>, signal?: AbortSignal) =>
    patchResource<AcademicYear>(ACADEMIC_ENDPOINTS.academicYears, id, payload, signal),
};

export const semestersApi = {
  list: (signal?: AbortSignal) =>
    listResource<Semester>(ACADEMIC_ENDPOINTS.semesters, signal),
  create: (payload: SemesterWrite, signal?: AbortSignal) =>
    createResource<Semester>(ACADEMIC_ENDPOINTS.semesters, payload, signal),
  update: (id: number, payload: Partial<SemesterWrite>, signal?: AbortSignal) =>
    patchResource<Semester>(ACADEMIC_ENDPOINTS.semesters, id, payload, signal),
};

export const programsApi = {
  list: (signal?: AbortSignal) =>
    listResource<StudyProgram>(ACADEMIC_ENDPOINTS.programs, signal),
  create: (payload: StudyProgramWrite, signal?: AbortSignal) =>
    createResource<StudyProgram>(ACADEMIC_ENDPOINTS.programs, payload, signal),
  update: (id: number, payload: Partial<StudyProgramWrite>, signal?: AbortSignal) =>
    patchResource<StudyProgram>(ACADEMIC_ENDPOINTS.programs, id, payload, signal),
};

export const stagesApi = {
  list: (signal?: AbortSignal) => listResource<StudyStage>(ACADEMIC_ENDPOINTS.stages, signal),
  create: (payload: StudyStageWrite, signal?: AbortSignal) =>
    createResource<StudyStage>(ACADEMIC_ENDPOINTS.stages, payload, signal),
  update: (id: number, payload: Partial<StudyStageWrite>, signal?: AbortSignal) =>
    patchResource<StudyStage>(ACADEMIC_ENDPOINTS.stages, id, payload, signal),
};

export const studentGroupsApi = {
  list: (signal?: AbortSignal) =>
    listResource<StudentGroup>(ACADEMIC_ENDPOINTS.studentGroups, signal),
  create: (payload: StudentGroupWrite, signal?: AbortSignal) =>
    createResource<StudentGroup>(ACADEMIC_ENDPOINTS.studentGroups, payload, signal),
  update: (id: number, payload: Partial<StudentGroupWrite>, signal?: AbortSignal) =>
    patchResource<StudentGroup>(ACADEMIC_ENDPOINTS.studentGroups, id, payload, signal),
};

export const coursesApi = {
  list: (signal?: AbortSignal) => listResource<Course>(ACADEMIC_ENDPOINTS.courses, signal),
  create: (payload: CourseWrite, signal?: AbortSignal) =>
    createResource<Course>(ACADEMIC_ENDPOINTS.courses, payload, signal),
  update: (id: number, payload: Partial<CourseWrite>, signal?: AbortSignal) =>
    patchResource<Course>(ACADEMIC_ENDPOINTS.courses, id, payload, signal),
};

export const courseOfferingsApi = {
  list: (signal?: AbortSignal) =>
    listResource<CourseOffering>(ACADEMIC_ENDPOINTS.courseOfferings, signal),
  create: (payload: CourseOfferingWrite, signal?: AbortSignal) =>
    createResource<CourseOffering>(ACADEMIC_ENDPOINTS.courseOfferings, payload, signal),
  update: (id: number, payload: Partial<CourseOfferingWrite>, signal?: AbortSignal) =>
    patchResource<CourseOffering>(ACADEMIC_ENDPOINTS.courseOfferings, id, payload, signal),
};

export const teachingComponentsApi = {
  list: (signal?: AbortSignal) =>
    listResource<TeachingComponent>(ACADEMIC_ENDPOINTS.teachingComponents, signal),
  create: (payload: TeachingComponentWrite, signal?: AbortSignal) =>
    createResource<TeachingComponent>(
      ACADEMIC_ENDPOINTS.teachingComponents,
      payload,
      signal,
    ),
  update: (id: number, payload: Partial<TeachingComponentWrite>, signal?: AbortSignal) =>
    patchResource<TeachingComponent>(
      ACADEMIC_ENDPOINTS.teachingComponents,
      id,
      payload,
      signal,
    ),
};

export const teachingComponentGroupsApi = {
  list: (signal?: AbortSignal) =>
    listResource<TeachingComponentGroup>(
      ACADEMIC_ENDPOINTS.teachingComponentGroups,
      signal,
    ),
  create: (payload: TeachingComponentGroupWrite, signal?: AbortSignal) =>
    createResource<TeachingComponentGroup>(
      ACADEMIC_ENDPOINTS.teachingComponentGroups,
      payload,
      signal,
    ),
  update: (
    id: number,
    payload: Partial<TeachingComponentGroupWrite>,
    signal?: AbortSignal,
  ) =>
    patchResource<TeachingComponentGroup>(
      ACADEMIC_ENDPOINTS.teachingComponentGroups,
      id,
      payload,
      signal,
    ),
};
