import { describe, expect, it } from 'vitest';

import {
  academicYearFields,
  academicYearFormValues,
  academicYearPayload,
  applyAcademicYearDerivation,
  applyOfferingDerivation,
  collegePayload,
  componentGroupFields,
  componentGroupFormValues,
  componentGroupPayload,
  courseFields,
  courseFormValues,
  courseOfferingFields,
  courseOfferingFormValues,
  courseOfferingPayload,
  coursePayload,
  departmentFields,
  departmentPayload,
  parentGroupOptionsFor,
  programFields,
  programFormValues,
  programPayload,
  semesterFields,
  semesterFormValues,
  semesterPayload,
  stageFields,
  studentGroupFields,
  studentGroupFormValues,
  studentGroupPayload,
  teachingComponentFields,
  teachingComponentFormValues,
  teachingComponentPayload,
  studentGroupOptions,
  type FieldOption,
  type FormFieldSpec,
  type FormValues,
} from '@/lib/academic/forms';
import { buildFormContext } from '@/lib/academic/forms';
import {
  academicYearRow,
  collegeAdmin,
  componentGroupRow,
  courseOfferingRow,
  courseRow,
  departmentAdmin,
  departmentRow,
  programRow,
  semesterRow,
  studentGroupRow,
  teachingComponentRow,
} from '@/test/academic-fixtures';

const DEPARTMENT_OPTIONS: FieldOption[] = [
  { value: '2', label: 'BIOAI — Biomedical AI' },
  { value: '99', label: 'CS — Computer Science' },
];

function field(fields: readonly FormFieldSpec[], name: string): FormFieldSpec {
  const found = fields.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(`Field "${name}" is not part of the form.`);
  }
  return found;
}

describe('academic year form', () => {
  it('fills the end year from the start year', () => {
    const derived = applyAcademicYearDerivation('start_year', '2026', {
      start_year: '2026',
      end_year: '',
    });
    expect(derived?.end_year).toBe('2027');
  });

  it('leaves other fields alone', () => {
    expect(
      applyAcademicYearDerivation('end_year', '2027', {
        start_year: '2026',
        end_year: '2027',
      }),
    ).toBeNull();
    expect(
      applyAcademicYearDerivation('start_year', '2026', {
        start_year: '2026',
        end_year: '2027',
      }),
    ).toBeNull();
  });

  it('rejects non-consecutive years before the request is sent', () => {
    const endYear = field(academicYearFields(), 'end_year');
    expect(endYear.validate?.('2028', { start_year: '2026', end_year: '2028' })).toBe(
      'End year must be exactly one year after the start year.',
    );
    expect(endYear.validate?.('2027', { start_year: '2026', end_year: '2027' })).toBeNull();
  });

  it('round-trips values and payload', () => {
    expect(academicYearFormValues(academicYearRow())).toEqual({
      start_year: '2026',
      end_year: '2027',
      is_active: 'true',
    });
    expect(
      academicYearPayload({ start_year: '2026', end_year: '2027', is_active: 'true' }),
    ).toEqual({ start_year: 2026, end_year: 2027, is_active: true });
  });
});

describe('semester form', () => {
  const yearOptions: FieldOption[] = [{ value: '3', label: '2026–2027' }];

  it('offers first and second semester only', () => {
    const number = field(semesterFields(yearOptions, false), 'number');
    expect(number.options?.map((option) => option.value)).toEqual(['1', '2']);
    expect(number.options?.map((option) => option.label)).toEqual(['First', 'Second']);
  });

  it('locks the academic year when it cannot be chosen', () => {
    expect(field(semesterFields(yearOptions, true), 'academic_year').locked).toBe(true);
    expect(field(semesterFields(yearOptions, false), 'academic_year').locked).toBe(false);
  });

  it('keeps the semester number and academic year as identifiers in the payload', () => {
    const payload = semesterPayload({
      academic_year: '3',
      number: '2',
      start_date: '2027-02-01',
      end_date: '',
      is_active: 'true',
    });
    // The label "Second" must never reach the backend.
    expect(payload).toEqual({
      number: 2,
      start_date: '2027-02-01',
      end_date: null,
      academic_year: 3,
      is_active: true,
    });
  });

  it('reads optional dates back into the form', () => {
    expect(semesterFormValues(semesterRow({ start_date: null, end_date: null }))).toEqual({
      academic_year: '3',
      number: '1',
      start_date: '',
      end_date: '',
      is_active: 'true',
    });
  });
});

describe('study program form', () => {
  const context = buildFormContext(collegeAdmin);

  it('offers the backend study types with display labels only', () => {
    const studyType = field(programFields(DEPARTMENT_OPTIONS, true), 'study_type');
    expect(studyType.options).toEqual([
      { value: 'UNDERGRADUATE', label: 'Undergraduate' },
      { value: 'MASTER', label: 'Master' },
      { value: 'PHD', label: 'PhD' },
    ]);
  });

  it('sends the study type value, never the label', () => {
    const values = programFormValues(programRow(), context);
    expect(programPayload({ ...values, study_type: 'PHD' })).toEqual({
      name: 'Biomedical AI',
      code: 'BIOAI',
      study_type: 'PHD',
      department: 2,
      is_active: true,
    });
  });

  it('fixes the department for a department administrator', () => {
    const departmentField = field(programFields(DEPARTMENT_OPTIONS, false), 'department');
    expect(departmentField.locked).toBe(true);

    const scoped = buildFormContext(departmentAdmin);
    expect(programFormValues(null, scoped).department).toBe('2');
  });
});

describe('study stage form', () => {
  it('keeps the stage number a positive integer', () => {
    const number = field(stageFields([]), 'number');
    expect(number.validate?.('0', {})).toBe(
      'Stage number must be a whole number greater than zero.',
    );
    expect(number.validate?.('2', {})).toBeNull();
  });

  it('requires a study program', () => {
    const program = field(stageFields([{ value: '4', label: 'BIOAI — Biomedical AI' }]), 'program');
    expect(program.required).toBe(true);
    expect(program.validate?.('', {})).toBe('Study program is required.');
  });
});

describe('student group form', () => {
  const groups = [
    studentGroupRow({ id: 6, code: 'A', name: 'Group A' }),
    studentGroupRow({ id: 12, code: 'A1', name: 'Group A1', parent_group: { id: 6, name: 'Group A', code: 'A' } }),
    studentGroupRow({
      id: 13,
      code: 'B',
      name: 'Group B',
      stage: { id: 15, number: 3, name: 'Stage 3' },
    }),
  ];

  it('filters parent options to the selected stage', () => {
    const options = parentGroupOptionsFor(groups, { stage: '5' }, null);
    expect(options.map((option) => option.value)).toEqual(['6', '12']);
  });

  it('excludes the group being edited', () => {
    const options = parentGroupOptionsFor(groups, { stage: '5' }, 6);
    expect(options.map((option) => option.value)).toEqual(['12']);
  });

  it('offers no parent before a stage is chosen', () => {
    expect(parentGroupOptionsFor(groups, { stage: '' }, null)).toEqual([]);
  });

  it('sends a null parent when none is selected', () => {
    const values = studentGroupFormValues(studentGroupRow({ id: 6 }));
    expect(studentGroupPayload(values)).toEqual({
      name: 'Group A',
      code: 'A',
      student_count: 42,
      stage: 5,
      parent_group: null,
      is_active: true,
    });
  });

  it('sends the parent id when a subgroup is chosen', () => {
    const values = studentGroupFormValues(
      studentGroupRow({
        id: 12,
        parent_group: { id: 6, name: 'Group A', code: 'A' },
      }),
    );
    expect(values.parent_group).toBe('6');
    expect(studentGroupPayload(values).parent_group).toBe(6);
  });

  it('labels group options with code, stage and name', () => {
    expect(studentGroupOptions([studentGroupRow()])[0]?.label).toBe('A — Stage 2 — Group A');
  });

  it('labels the parent field and validates the student count', () => {
    const fields = studentGroupFields([], []);
    expect(field(fields, 'student_count').validate?.('-2', {})).toBe(
      'Student count must be a whole number, zero or greater.',
    );
  });
});

describe('course and course offering forms', () => {
  const context = buildFormContext(collegeAdmin);
  const courses = [courseRow({ id: 7, department: { id: 2, name: 'Biomedical AI', code: 'BIOAI' } })];

  it('fixes the owning department for a department administrator', () => {
    expect(field(courseFields(DEPARTMENT_OPTIONS, false), 'department').locked).toBe(true);
    expect(field(courseFields(DEPARTMENT_OPTIONS, true), 'department').locked).toBe(false);
  });

  it('derives the managing department from the selected course', () => {
    const derived = applyOfferingDerivation(courses, 'course', '7', {
      course: '7',
      managing_department: '',
    });
    expect(derived?.managing_department).toBe('2');
  });

  it('keeps the managing department derived and locked', () => {
    const fields = courseOfferingFields([], [], DEPARTMENT_OPTIONS);
    const managing = field(fields, 'managing_department');
    expect(managing.locked).toBe(true);
    expect(managing.lockedReason).toMatch(/department that owns the course/);
  });

  it('submits foreign keys as ids', () => {
    const values = courseOfferingFormValues(courseOfferingRow(), courses);
    expect(values).toMatchObject({
      course: '7',
      managing_department: '2',
      semester: '8',
      offering_code: 'MAIN',
    });
    expect(courseOfferingPayload(values)).toEqual({
      course: 7,
      semester: 8,
      managing_department: 2,
      offering_code: 'MAIN',
      is_active: true,
    });
  });

  it('sends course descriptions as text', () => {
    expect(coursePayload({ ...courseFormValues(courseRow(), context) })).toEqual({
      name: 'Machine Learning',
      code: 'ML301',
      description: 'Supervised learning foundations.',
      department: 2,
      is_active: true,
    });
  });
});

describe('teaching component form', () => {
  it('validates weekly hours and session duration against each other', () => {
    const fields = teachingComponentFields([]);
    const weekly = field(fields, 'weekly_hours');
    const duration = field(fields, 'session_duration_hours');

    expect(
      weekly.validate?.('3', { weekly_hours: '3', session_duration_hours: '2' }),
    ).toBeNull();
    expect(
      duration.validate?.('2', { weekly_hours: '3', session_duration_hours: '2' }),
    ).toBe(
      'Session duration must divide the weekly hours into whole sessions; rounding is not applied.',
    );
    expect(weekly.validate?.('1', { weekly_hours: '1', session_duration_hours: '1.5' })).toBe(
      'Weekly hours must be at least one session duration.',
    );
  });

  it('submits decimals as backend-shaped strings', () => {
    const values = teachingComponentFormValues(
      teachingComponentRow({ weekly_hours: '3.00', session_duration_hours: '1.50' }),
    );
    expect(teachingComponentPayload(values)).toEqual({
      offering: 9,
      component_type: 'THEORY',
      label: 'Lecture A',
      weekly_hours: '3.00',
      session_duration_hours: '1.50',
      is_active: true,
    });
  });

  it('normalises loosely typed decimals', () => {
    const payload = teachingComponentPayload({
      offering: '9',
      component_type: 'PRACTICAL',
      label: '',
      weekly_hours: '2',
      session_duration_hours: '0.5',
      is_active: 'false',
    });
    expect(payload.weekly_hours).toBe('2.00');
    expect(payload.session_duration_hours).toBe('0.50');
    expect(payload.is_active).toBe(false);
  });
});

describe('component group form', () => {
  it('explains the cross-department rule', () => {
    const college = field(componentGroupFields([], [], true), 'student_group');
    expect(college.helpText).toMatch(/college administrator/i);
    expect(college.helpText).toMatch(/ancestor or descendant/);

    const department = field(componentGroupFields([], [], false), 'student_group');
    expect(department.helpText).toMatch(/your own department/i);
  });

  it('submits the component and group ids', () => {
    const values = componentGroupFormValues(componentGroupRow());
    expect(componentGroupPayload(values)).toEqual({
      teaching_component: 10,
      student_group: 6,
    });
  });
});

describe('entity payload hygiene', () => {
  it('never sends display labels or timestamps', () => {
    const payloads: object[] = [
      collegePayload({ name: 'AI', code: 'AI', is_active: 'true' }),
      departmentPayload({ name: 'BIOAI', code: 'BIOAI', college: '1', is_active: 'true' }),
      programPayload({
        name: 'Biomedical AI',
        code: 'BIOAI',
        study_type: 'UNDERGRADUATE',
        department: '2',
        is_active: 'true',
      }),
      studentGroupPayload(studentGroupFormValues(studentGroupRow())),
      coursePayload(courseFormValues(courseRow(), buildFormContext(collegeAdmin))),
    ];

    for (const payload of payloads) {
      expect(Object.keys(payload)).not.toContain('created_at');
      expect(Object.keys(payload)).not.toContain('updated_at');
      expect(Object.keys(payload)).not.toContain('id');
    }
  });

  it('trims text before sending it', () => {
    expect(
      collegePayload({ name: '  College of AI  ', code: ' AI ', is_active: 'true' }),
    ).toEqual({ name: 'College of AI', code: 'AI', is_active: true });
  });

  it('defaults the active flag to true when the field is absent', () => {
    expect(collegePayload({ name: 'AI', code: 'AI' }).is_active).toBe(true);
  });

  it('reads a program department fallback from the context', () => {
    const context = buildFormContext(departmentAdmin);
    const values: FormValues = programFormValues(null, context);
    expect(values).toMatchObject({
      name: '',
      code: '',
      study_type: 'UNDERGRADUATE',
      department: '2',
      is_active: 'true',
    });
  });

  it('describes the department form fields in backend order', () => {
    expect(
      departmentFields(DEPARTMENT_OPTIONS, true).map((candidate) => candidate.name),
    ).toEqual(['name', 'code', 'college', 'is_active']);
  });

  it('exposes the fixture-backed department row used by capability tests', () => {
    expect(departmentRow().id).toBe(2);
  });
});
