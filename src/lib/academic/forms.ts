/**
 * Declarative form definitions for the academic entities.
 *
 * Every form is described by field specifications plus two pure functions:
 * one that turns a read model into form values, and one that turns form values
 * into a write payload. Keeping them pure means the form logic is unit-testable
 * without rendering, and that no display label can leak into a request body.
 *
 * Values are held as strings (form controls are strings) and converted at the
 * payload boundary. Decimal fields stay decimal strings end to end.
 */

import {
  SEMESTER_NUMBER_OPTIONS,
  STUDY_TYPE_OPTIONS,
  TEACHING_COMPONENT_TYPE_OPTIONS,
} from '@/lib/academic/constants';
import { formatGroupOption, formatOfferingLabel } from '@/lib/academic/formatters';
import type { AcademicCapabilityUser } from '@/lib/academic/permissions';
import { isDepartmentAdmin, ownDepartmentId } from '@/lib/academic/permissions';
import type {
  AcademicYear,
  AcademicYearWrite,
  College,
  CollegeWrite,
  Course,
  CourseOffering,
  CourseOfferingWrite,
  CourseWrite,
  DecimalString,
  Department,
  DepartmentWrite,
  Semester,
  SemesterNumber,
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
  StudyType,
  TeachingComponentType,
} from '@/lib/academic/types';
import {
  parseDecimalInput,
  suggestedEndYear,
  validateAcademicYearRange,
  validatePositiveInteger,
  validateSemesterDates,
  validateStudentCount,
  validateTeachingComponentHours,
} from '@/lib/academic/validation';

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'time'
  | 'checkbox';

export type FormValues = Record<string, string>;

export interface FieldOption {
  value: string;
  label: string;
}

export interface FormFieldSpec {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  autoComplete?: string;
  options?: readonly FieldOption[];
  /** Rendered but not editable; the value is still submitted. */
  locked?: boolean;
  /** Explains why a control is locked. */
  lockedReason?: string;
  /** Client-side check; returns a message or `null`. */
  validate?: (value: string, values: FormValues) => string | null;
  /** Additional values set when this field changes. */
  derive?: (value: string, values: FormValues) => FormValues | null;
  /** Field is only rendered when this returns true. */
  visible?: (values: FormValues) => boolean;
  /** Marks a field as non-submittable (e.g. a read-only display row). */
  notSubmittable?: boolean;
}

export interface FormContext {
  user: AcademicCapabilityUser | null;
  ownDepartmentId: number | null;
  isCollegeAdmin: boolean;
}

export function buildFormContext(user: AcademicCapabilityUser | null): FormContext {
  return {
    user,
    ownDepartmentId: ownDepartmentId(user),
    isCollegeAdmin: !isDepartmentAdmin(user) && user?.role === 'COLLEGE_ADMIN',
  };
}

// --- Option builders ------------------------------------------------------

export function toOptions<T>(
  items: readonly T[],
  getValue: (item: T) => number,
  getLabel: (item: T) => string,
): FieldOption[] {
  return items.map((item) => ({ value: String(getValue(item)), label: getLabel(item) }));
}

export function collegeOptions(colleges: readonly College[]): FieldOption[] {
  return toOptions(
    colleges,
    (college) => college.id,
    (college) => `${college.code} — ${college.name}`,
  );
}

export function departmentOptions(departments: readonly Department[]): FieldOption[] {
  return toOptions(
    departments,
    (department) => department.id,
    (department) => `${department.code} — ${department.name}`,
  );
}

export function academicYearOptions(years: readonly AcademicYear[]): FieldOption[] {
  return toOptions(
    years,
    (year) => year.id,
    (year) => `${year.start_year}–${year.end_year}`,
  );
}

export function semesterOptions(semesters: readonly Semester[]): FieldOption[] {
  return toOptions(
    semesters,
    (semester) => semester.id,
    (semester) =>
      `${semester.academic_year.start_year}–${semester.academic_year.end_year} · ${
        semester.number === 1 ? 'First' : 'Second'
      }`,
  );
}

export function programOptions(programs: readonly StudyProgram[]): FieldOption[] {
  return toOptions(
    programs,
    (program) => program.id,
    (program) => `${program.code} — ${program.name}`,
  );
}

export function stageOptions(stages: readonly StudyStage[]): FieldOption[] {
  return toOptions(
    stages,
    (stage) => stage.id,
    (stage) => `${stage.program.code} — Stage ${stage.number} · ${stage.name}`,
  );
}

export function courseOptions(courses: readonly Course[]): FieldOption[] {
  return toOptions(
    courses,
    (course) => course.id,
    (course) => `${course.code} — ${course.name}`,
  );
}

export function offeringOptions(offerings: readonly CourseOffering[]): FieldOption[] {
  return toOptions(offerings, (offering) => offering.id, formatOfferingLabel);
}

export function studentGroupOptions(groups: readonly StudentGroup[]): FieldOption[] {
  return toOptions(
    groups,
    (group) => group.id,
    (group) => formatGroupOption(group.code, group.stage.number, group.name),
  );
}

export function teachingComponentOptions(
  components: readonly TeachingComponent[],
): FieldOption[] {
  return toOptions(
    components,
    (component) => component.id,
    (component) =>
      `${component.offering.course.code} — ${
        component.component_type === 'THEORY' ? 'Theory' : 'Practical'
      }${component.label ? ` (${component.label})` : ''}`,
  );
}

// --- Shared parsers -------------------------------------------------------

function required(value: string, message: string): string | null {
  return value.trim().length === 0 ? message : null;
}

function readBoolean(values: FormValues, key: string, fallback: boolean): boolean {
  const raw = values[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  return raw === 'true';
}

function readRequiredId(values: FormValues, key: string): number {
  return Number(values[key]);
}

function readOptionalId(values: FormValues, key: string): number | null {
  const raw = (values[key] ?? '').trim();
  return raw.length === 0 ? null : Number(raw);
}

/** Trimmed text value; missing keys read as an empty string. */
function readText(values: FormValues, key: string): string {
  return (values[key] ?? '').trim();
}

function decimalOrNull(value: string): DecimalString | null {
  return parseDecimalInput(value);
}

// --- College --------------------------------------------------------------

export function collegeFields(): FormFieldSpec[] {
  return [
    {
      name: 'name',
      label: 'Name',
      kind: 'text',
      required: true,
      placeholder: 'College of Artificial Intelligence',
      validate: (value) => required(value, 'Name is required.'),
    },
    {
      name: 'code',
      label: 'Code',
      kind: 'text',
      required: true,
      placeholder: 'AI',
      helpText: 'Short unique identifier, for example AI, ENG or MED.',
      validate: (value) => required(value, 'Code is required.'),
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function collegeFormValues(college: College | null): FormValues {
  return {
    name: college?.name ?? '',
    code: college?.code ?? '',
    is_active: String(college?.is_active ?? true),
  };
}

export function collegePayload(values: FormValues): CollegeWrite {
  return {
    name: readText(values, 'name'),
    code: readText(values, 'code'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Academic year --------------------------------------------------------

export function academicYearFields(): FormFieldSpec[] {
  return [
    {
      name: 'start_year',
      label: 'Start year',
      kind: 'integer',
      required: true,
      placeholder: '2026',
      validate: (value) => validatePositiveInteger(value, 'Start year'),
    },
    {
      name: 'end_year',
      label: 'End year',
      kind: 'integer',
      required: true,
      placeholder: '2027',
      helpText: 'Must be exactly one year after the start year.',
      validate: (value, values) =>
        validateAcademicYearRange(values.start_year ?? '', value).errors.end_year ?? null,
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

/** Fills `end_year` from `start_year` while the user types the start year. */
export function applyAcademicYearDerivation(
  name: string,
  value: string,
  values: FormValues,
): FormValues | null {
  if (name !== 'start_year') {
    return null;
  }
  const suggested = suggestedEndYear(value);
  if (suggested === null || values.end_year === suggested) {
    return null;
  }
  return { ...values, end_year: suggested };
}

export function academicYearFormValues(year: AcademicYear | null): FormValues {
  return {
    start_year: year ? String(year.start_year) : '',
    end_year: year ? String(year.end_year) : '',
    is_active: String(year?.is_active ?? true),
  };
}

export function academicYearPayload(values: FormValues): AcademicYearWrite {
  return {
    start_year: Number(values.start_year),
    end_year: Number(values.end_year),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Semester -------------------------------------------------------------

export function semesterFields(
  yearOptions: readonly FieldOption[],
  lockYear: boolean,
): FormFieldSpec[] {
  return [
    {
      name: 'academic_year',
      label: 'Academic year',
      kind: 'select',
      required: true,
      options: yearOptions,
      locked: lockYear,
      validate: (value) => required(value, 'Academic year is required.'),
    },
    {
      name: 'number',
      label: 'Semester',
      kind: 'select',
      required: true,
      options: SEMESTER_NUMBER_OPTIONS,
      validate: (value) => required(value, 'Semester is required.'),
    },
    { name: 'start_date', label: 'Start date', kind: 'date', helpText: 'Optional.' },
    {
      name: 'end_date',
      label: 'End date',
      kind: 'date',
      helpText: 'Optional. Must not be before the start date.',
      validate: (value, values) =>
        validateSemesterDates(values.start_date ?? '', value).errors.end_date ?? null,
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function semesterFormValues(semester: Semester | null): FormValues {
  return {
    academic_year: semester ? String(semester.academic_year.id) : '',
    number: semester ? String(semester.number) : '1',
    start_date: semester?.start_date ?? '',
    end_date: semester?.end_date ?? '',
    is_active: String(semester?.is_active ?? true),
  };
}

export function semesterPayload(values: FormValues): SemesterWrite {
  const startDate = (values.start_date ?? '').trim();
  const endDate = (values.end_date ?? '').trim();
  return {
    number: Number(values.number) as SemesterNumber,
    start_date: startDate.length === 0 ? null : startDate,
    end_date: endDate.length === 0 ? null : endDate,
    academic_year: readRequiredId(values, 'academic_year'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Department -----------------------------------------------------------

export function departmentFields(
  collegeOptionList: readonly FieldOption[],
  isCollegeAdmin: boolean,
): FormFieldSpec[] {
  return [
    {
      name: 'name',
      label: 'Name',
      kind: 'text',
      required: true,
      validate: (value) => required(value, 'Name is required.'),
    },
    {
      name: 'code',
      label: 'Code',
      kind: 'text',
      required: true,
      placeholder: 'BIOAI',
      validate: (value) => required(value, 'Code is required.'),
    },
    {
      name: 'college',
      label: 'College',
      kind: 'select',
      required: isCollegeAdmin,
      options: collegeOptionList,
      locked: !isCollegeAdmin,
      lockedReason: isCollegeAdmin
        ? undefined
        : 'Departments stay in their college. Only a college administrator can move one.',
      helpText: 'Required when creating a department.',
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function departmentFormValues(department: Department | null): FormValues {
  return {
    name: department?.name ?? '',
    code: department?.code ?? '',
    college: department?.college ? String(department.college.id) : '',
    is_active: String(department?.is_active ?? true),
  };
}

/**
 * Build the department payload.
 *
 * `college` is omitted when no college is set. That is always correct here: the
 * create form requires a college, so the field can only be missing for a legacy
 * row without one, where a partial update must not invent a value.
 */
export function departmentPayload(values: FormValues): Partial<DepartmentWrite> {
  const payload: Partial<DepartmentWrite> = {
    name: readText(values, 'name'),
    code: readText(values, 'code'),
    is_active: readBoolean(values, 'is_active', true),
  };
  const college = readText(values, 'college');
  if (college.length > 0) {
    payload.college = Number(college);
  }
  return payload;
}

// --- Study program --------------------------------------------------------

export function programFields(
  departmentOptionList: readonly FieldOption[],
  isCollegeAdmin: boolean,
): FormFieldSpec[] {
  return [
    {
      name: 'name',
      label: 'Name',
      kind: 'text',
      required: true,
      placeholder: 'Biomedical AI',
      validate: (value) => required(value, 'Name is required.'),
    },
    {
      name: 'code',
      label: 'Code',
      kind: 'text',
      required: true,
      placeholder: 'BIOAI',
      validate: (value) => required(value, 'Code is required.'),
    },
    {
      name: 'study_type',
      label: 'Study type',
      kind: 'select',
      required: true,
      options: STUDY_TYPE_OPTIONS,
      validate: (value) => required(value, 'Study type is required.'),
    },
    {
      name: 'department',
      label: 'Department',
      kind: 'select',
      required: true,
      options: departmentOptionList,
      locked: !isCollegeAdmin,
      lockedReason: 'Programs are managed inside your own department.',
      validate: (value) => required(value, 'Department is required.'),
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function programFormValues(
  program: StudyProgram | null,
  context: FormContext,
): FormValues {
  const fallbackDepartment = context.ownDepartmentId === null ? '' : String(context.ownDepartmentId);
  return {
    name: program?.name ?? '',
    code: program?.code ?? '',
    study_type: program?.study_type ?? 'UNDERGRADUATE',
    department: program ? String(program.department.id) : fallbackDepartment,
    is_active: String(program?.is_active ?? true),
  };
}

export function programPayload(values: FormValues): StudyProgramWrite {
  return {
    name: readText(values, 'name'),
    code: readText(values, 'code'),
    study_type: values.study_type as StudyType,
    department: readRequiredId(values, 'department'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Study stage ----------------------------------------------------------

export function stageFields(
  programOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'program',
      label: 'Study program',
      kind: 'select',
      required: true,
      options: programOptionList,
      validate: (value) => required(value, 'Study program is required.'),
    },
    {
      name: 'number',
      label: 'Stage number',
      kind: 'integer',
      required: true,
      placeholder: '1',
      validate: (value) => validatePositiveInteger(value, 'Stage number'),
    },
    {
      name: 'name',
      label: 'Name',
      kind: 'text',
      required: true,
      placeholder: 'Stage 1',
      validate: (value) => required(value, 'Name is required.'),
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function stageFormValues(stage: StudyStage | null): FormValues {
  return {
    program: stage ? String(stage.program.id) : '',
    number: stage ? String(stage.number) : '',
    name: stage?.name ?? '',
    is_active: String(stage?.is_active ?? true),
  };
}

export function stagePayload(values: FormValues): StudyStageWrite {
  return {
    number: Number(values.number),
    name: readText(values, 'name'),
    program: readRequiredId(values, 'program'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Student group --------------------------------------------------------

export function studentGroupFields(
  stageOptionList: readonly FieldOption[],
  parentOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'stage',
      label: 'Stage',
      kind: 'select',
      required: true,
      options: stageOptionList,
      validate: (value) => required(value, 'Stage is required.'),
    },
    {
      name: 'name',
      label: 'Name',
      kind: 'text',
      required: true,
      placeholder: 'Group A',
      validate: (value) => required(value, 'Name is required.'),
    },
    {
      name: 'code',
      label: 'Code',
      kind: 'text',
      required: true,
      placeholder: 'A',
      validate: (value) => required(value, 'Code is required.'),
    },
    {
      name: 'student_count',
      label: 'Student count',
      kind: 'integer',
      required: true,
      placeholder: '0',
      validate: (value) => validateStudentCount(value),
    },
    {
      name: 'parent_group',
      label: 'Parent group',
      kind: 'select',
      helpText:
        'Optional. A subgroup must belong to the same stage as its parent group.',
      options: parentOptionList,
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

/**
 * Parent-group choices for the selected stage.
 *
 * The current group is excluded so it can never be its own parent, and options
 * are limited to the selected stage: the deeper recursive hierarchy rules stay
 * on the backend, whose errors are displayed verbatim.
 */
export function parentGroupOptionsFor(
  groups: readonly StudentGroup[],
  values: FormValues,
  currentGroupId: number | null,
): FieldOption[] {
  const stageId = (values.stage ?? '').trim();
  if (stageId.length === 0) {
    return [];
  }
  return toOptions(
    groups.filter(
      (group) => String(group.stage.id) === stageId && group.id !== currentGroupId,
    ),
    (group) => group.id,
    (group) => `${group.code} — ${group.name}`,
  );
}

export function studentGroupFormValues(group: StudentGroup | null): FormValues {
  return {
    stage: group ? String(group.stage.id) : '',
    name: group?.name ?? '',
    code: group?.code ?? '',
    student_count: group ? String(group.student_count) : '0',
    parent_group: group?.parent_group ? String(group.parent_group.id) : '',
    is_active: String(group?.is_active ?? true),
  };
}

export function studentGroupPayload(values: FormValues): StudentGroupWrite {
  return {
    name: readText(values, 'name'),
    code: readText(values, 'code'),
    student_count: Number(values.student_count),
    stage: readRequiredId(values, 'stage'),
    parent_group: readOptionalId(values, 'parent_group'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Course ---------------------------------------------------------------

export function courseFields(
  departmentOptionList: readonly FieldOption[],
  isCollegeAdmin: boolean,
): FormFieldSpec[] {
  return [
    {
      name: 'name',
      label: 'Name',
      kind: 'text',
      required: true,
      placeholder: 'Machine Learning',
      validate: (value) => required(value, 'Name is required.'),
    },
    {
      name: 'code',
      label: 'Code',
      kind: 'text',
      required: true,
      placeholder: 'ML301',
      validate: (value) => required(value, 'Code is required.'),
    },
    {
      name: 'department',
      label: 'Owning department',
      kind: 'select',
      required: true,
      options: departmentOptionList,
      locked: !isCollegeAdmin,
      lockedReason: 'Courses are owned by your own department.',
      validate: (value) => required(value, 'Department is required.'),
    },
    { name: 'description', label: 'Description', kind: 'textarea' },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function courseFormValues(course: Course | null, context: FormContext): FormValues {
  const fallbackDepartment =
    context.ownDepartmentId === null ? '' : String(context.ownDepartmentId);
  return {
    name: course?.name ?? '',
    code: course?.code ?? '',
    department: course ? String(course.department.id) : fallbackDepartment,
    description: course?.description ?? '',
    is_active: String(course?.is_active ?? true),
  };
}

export function coursePayload(values: FormValues): CourseWrite {
  return {
    name: readText(values, 'name'),
    code: readText(values, 'code'),
    description: values.description ?? '',
    department: readRequiredId(values, 'department'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Course offering ------------------------------------------------------

export function courseOfferingFields(
  courseOptionList: readonly FieldOption[],
  semesterOptionList: readonly FieldOption[],
  departmentOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'course',
      label: 'Course',
      kind: 'select',
      required: true,
      options: courseOptionList,
      helpText: 'The managing department follows the course that owns it.',
      validate: (value) => required(value, 'Course is required.'),
    },
    {
      name: 'managing_department',
      label: 'Managing department',
      kind: 'select',
      required: true,
      options: departmentOptionList,
      locked: true,
      lockedReason:
        'An offering is always managed by the department that owns the course.',
    },
    {
      name: 'semester',
      label: 'Semester',
      kind: 'select',
      required: true,
      options: semesterOptionList,
      validate: (value) => required(value, 'Semester is required.'),
    },
    {
      name: 'offering_code',
      label: 'Offering code',
      kind: 'text',
      required: true,
      placeholder: 'MAIN',
      helpText: 'Short instance label, for example MAIN, A or EVENING.',
      validate: (value) => required(value, 'Offering code is required.'),
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

/**
 * Resolve the managing department for the selected course.
 *
 * The backend requires it to equal the course's owning department, so the value
 * is derived instead of being chosen.
 */
export function managingDepartmentForCourse(
  courses: readonly Course[],
  courseId: string,
): string {
  const course = courses.find((candidate) => String(candidate.id) === courseId.trim());
  return course ? String(course.department.id) : '';
}

export function applyOfferingDerivation(
  courses: readonly Course[],
  name: string,
  value: string,
  values: FormValues,
): FormValues | null {
  if (name !== 'course') {
    return null;
  }
  const derived = managingDepartmentForCourse(courses, value);
  if (values.managing_department === derived) {
    return null;
  }
  return { ...values, managing_department: derived };
}

export function courseOfferingFormValues(
  offering: CourseOffering | null,
  courses: readonly Course[],
): FormValues {
  const department = offering
    ? String(offering.managing_department.id)
    : managingDepartmentForCourse(courses, '');
  return {
    course: offering ? String(offering.course.id) : '',
    managing_department: department,
    semester: offering ? String(offering.semester.id) : '',
    offering_code: offering?.offering_code ?? 'MAIN',
    is_active: String(offering?.is_active ?? true),
  };
}

export function courseOfferingPayload(values: FormValues): CourseOfferingWrite {
  return {
    course: readRequiredId(values, 'course'),
    semester: readRequiredId(values, 'semester'),
    managing_department: readRequiredId(values, 'managing_department'),
    offering_code: readText(values, 'offering_code'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Teaching component ---------------------------------------------------

export function teachingComponentFields(
  offeringOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'offering',
      label: 'Course offering',
      kind: 'select',
      required: true,
      options: offeringOptionList,
      validate: (value) => required(value, 'Course offering is required.'),
    },
    {
      name: 'component_type',
      label: 'Component type',
      kind: 'select',
      required: true,
      options: TEACHING_COMPONENT_TYPE_OPTIONS,
      validate: (value) => required(value, 'Component type is required.'),
    },
    {
      name: 'label',
      label: 'Label',
      kind: 'text',
      placeholder: 'Lecture A',
      helpText: 'Optional human readable label.',
    },
    {
      name: 'weekly_hours',
      label: 'Weekly hours',
      kind: 'decimal',
      required: true,
      placeholder: '3',
      validate: (value, values) =>
        validateTeachingComponentHours({
          weekly_hours: value,
          session_duration_hours: values.session_duration_hours ?? '',
        }).errors.weekly_hours ?? null,
    },
    {
      name: 'session_duration_hours',
      label: 'Session duration (hours)',
      kind: 'decimal',
      required: true,
      placeholder: '1.5',
      helpText: 'Must divide the weekly hours into whole sessions.',
      validate: (value, values) =>
        validateTeachingComponentHours({
          weekly_hours: values.weekly_hours ?? '',
          session_duration_hours: value,
        }).errors.session_duration_hours ?? null,
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function teachingComponentFormValues(
  component: TeachingComponent | null,
): FormValues {
  return {
    offering: component ? String(component.offering.id) : '',
    component_type: component?.component_type ?? 'THEORY',
    label: component?.label ?? '',
    weekly_hours: component ? String(component.weekly_hours) : '',
    session_duration_hours: component ? String(component.session_duration_hours) : '',
    is_active: String(component?.is_active ?? true),
  };
}

export function teachingComponentPayload(values: FormValues): TeachingComponentWrite {
  return {
    offering: readRequiredId(values, 'offering'),
    component_type: values.component_type as TeachingComponentType,
    label: values.label ?? '',
    weekly_hours: decimalOrNull(values.weekly_hours ?? '') ?? readText(values, 'weekly_hours'),
    session_duration_hours:
      decimalOrNull(values.session_duration_hours ?? '') ??
      readText(values, 'session_duration_hours'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Teaching component group --------------------------------------------

export function componentGroupFields(
  componentOptionList: readonly FieldOption[],
  groupOptionList: readonly FieldOption[],
  allowsCrossDepartment: boolean,
): FormFieldSpec[] {
  const scopeNote = allowsCrossDepartment
    ? 'As a college administrator you may link a component to another department\u2019s group.'
    : 'Only components of offerings you manage and groups of your own department can be linked.';
  return [
    {
      name: 'teaching_component',
      label: 'Teaching component',
      kind: 'select',
      required: true,
      options: componentOptionList,
      validate: (value) => required(value, 'Teaching component is required.'),
    },
    {
      name: 'student_group',
      label: 'Student group',
      kind: 'select',
      required: true,
      options: groupOptionList,
      helpText: `${scopeNote} A component cannot contain both a group and one of its ancestor or descendant groups.`,
      validate: (value) => required(value, 'Student group is required.'),
    },
  ];
}

export function componentGroupFormValues(
  link: TeachingComponentGroup | null,
): FormValues {
  return {
    teaching_component: link ? String(link.teaching_component.id) : '',
    student_group: link ? String(link.student_group.id) : '',
  };
}

export function componentGroupPayload(
  values: FormValues,
): TeachingComponentGroupWrite {
  return {
    teaching_component: readRequiredId(values, 'teaching_component'),
    student_group: readRequiredId(values, 'student_group'),
  };
}
