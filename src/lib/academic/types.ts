/**
 * Academic administration models.
 *
 * Field names mirror the accepted backend exactly (Backend API v1.0.0,
 * `academics/serializers.py`). The API uses separate write and read
 * representations: writes submit foreign keys as primary keys, reads always
 * answer with compact nested summaries. Read and write types are therefore kept
 * separate and must never be assumed interchangeable.
 *
 * Hard deletes do not exist in this API: records are retired through
 * `is_active`. There is intentionally no delete DTO or delete helper anywhere in
 * this layer.
 */

/** Compact nested summaries returned by the read serializers. */
export interface CollegeSummary {
  id: number;
  name: string;
  code: string;
}

export interface DepartmentSummary {
  id: number;
  name: string;
  code: string;
}

export interface AcademicYearSummary {
  id: number;
  start_year: number;
  end_year: number;
}

export interface StudyProgramSummary {
  id: number;
  name: string;
  code: string;
  study_type: StudyType;
}

export interface StudyStageSummary {
  id: number;
  number: number;
  name: string;
}

export interface StudentGroupSummary {
  id: number;
  name: string;
  code: string;
}

export interface CourseSummary {
  id: number;
  name: string;
  code: string;
}

export interface SemesterSummary {
  id: number;
  number: SemesterNumber;
  academic_year: AcademicYearSummary;
}

export interface CourseOfferingSummary {
  id: number;
  offering_code: string;
  course: CourseSummary;
}

export interface TeachingComponentSummary {
  id: number;
  component_type: TeachingComponentType;
  label: string;
}

/** `StudyType` choices of the backend model. */
export type StudyType = 'UNDERGRADUATE' | 'MASTER' | 'PHD';

/** `TeachingComponentType` choices of the backend model. */
export type TeachingComponentType = 'THEORY' | 'PRACTICAL';

/** `SemesterNumber` choices: the two standard semesters of an academic year. */
export type SemesterNumber = 1 | 2;

/** ISO-8601 date (`YYYY-MM-DD`) as returned for `DateField` values. */
export type IsoDate = string;

/** ISO-8601 timestamp as returned for `created_at` / `updated_at`. */
export type IsoDateTime = string;

/** Decimal values are transmitted as strings to avoid float rounding. */
export type DecimalString = string;

// --- Read models -----------------------------------------------------------

export interface College {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  college: CollegeSummary | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AcademicYear {
  id: number;
  start_year: number;
  end_year: number;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Semester {
  id: number;
  number: SemesterNumber;
  start_date: IsoDate | null;
  end_date: IsoDate | null;
  academic_year: AcademicYearSummary;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface StudyProgram {
  id: number;
  name: string;
  code: string;
  study_type: StudyType;
  department: DepartmentSummary;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface StudyStage {
  id: number;
  number: number;
  name: string;
  program: StudyProgramSummary;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface StudentGroup {
  id: number;
  name: string;
  code: string;
  student_count: number;
  stage: StudyStageSummary;
  parent_group: StudentGroupSummary | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Course {
  id: number;
  name: string;
  code: string;
  description: string;
  department: DepartmentSummary;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface CourseOffering {
  id: number;
  offering_code: string;
  course: CourseSummary;
  semester: SemesterSummary;
  managing_department: DepartmentSummary;
  total_weekly_hours: DecimalString;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TeachingComponent {
  id: number;
  component_type: TeachingComponentType;
  label: string;
  weekly_hours: DecimalString;
  session_duration_hours: DecimalString;
  sessions_per_week: number | null;
  offering: CourseOfferingSummary;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TeachingComponentGroup {
  id: number;
  teaching_component: TeachingComponentSummary;
  student_group: StudentGroupSummary;
  created_at: IsoDateTime;
}

// --- Write DTOs -----------------------------------------------------------

export interface CollegeWrite {
  name: string;
  code: string;
  is_active: boolean;
}

export interface DepartmentWrite {
  name: string;
  code: string;
  college: number;
  is_active: boolean;
}

export interface AcademicYearWrite {
  start_year: number;
  end_year: number;
  is_active: boolean;
}

export interface SemesterWrite {
  number: SemesterNumber;
  start_date: IsoDate | null;
  end_date: IsoDate | null;
  academic_year: number;
  is_active: boolean;
}

export interface StudyProgramWrite {
  name: string;
  code: string;
  study_type: StudyType;
  department: number;
  is_active: boolean;
}

export interface StudyStageWrite {
  number: number;
  name: string;
  program: number;
  is_active: boolean;
}

export interface StudentGroupWrite {
  name: string;
  code: string;
  student_count: number;
  stage: number;
  parent_group: number | null;
  is_active: boolean;
}

export interface CourseWrite {
  name: string;
  code: string;
  description: string;
  department: number;
  is_active: boolean;
}

export interface CourseOfferingWrite {
  course: number;
  semester: number;
  managing_department: number;
  offering_code: string;
  is_active: boolean;
}

export interface TeachingComponentWrite {
  offering: number;
  component_type: TeachingComponentType;
  label: string;
  weekly_hours: DecimalString;
  session_duration_hours: DecimalString;
  is_active: boolean;
}

export interface TeachingComponentGroupWrite {
  teaching_component: number;
  student_group: number;
}

/**
 * Entity kinds used by the capability helpers.
 *
 * `is_active` is absent from `TeachingComponentGroup` by design: the backend
 * relation has no such field.
 */
export type AcademicEntityKind =
  | 'college'
  | 'department'
  | 'academic-year'
  | 'semester'
  | 'program'
  | 'stage'
  | 'student-group'
  | 'course'
  | 'course-offering'
  | 'teaching-component'
  | 'teaching-component-group';
