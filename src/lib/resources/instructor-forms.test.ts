import { describe, expect, it } from 'vitest';

import { buildFormContext } from '@/lib/academic/forms';
import {
  ACCOUNT_LINKING_NOTICE,
  AVAILABILITY_HARD_NOTICE,
  PREFERENCE_SOFT_NOTICE,
  SHARING_SCOPE_OPTIONS,
  SINGLE_PRIMARY_HINT,
} from '@/lib/resources/constants';
import {
  instructorAccessFields,
  instructorAccessFormValues,
  instructorAccessPayload,
  instructorAvailabilityFields,
  instructorAvailabilityFormValues,
  instructorAvailabilityPayload,
  instructorFields,
  instructorFormValues,
  instructorPayload,
  instructorPreferenceFields,
  instructorPreferenceFormValues,
  instructorPreferencePayload,
  teachingAssignmentFields,
  teachingAssignmentFormValues,
  teachingAssignmentPayload,
  type FieldOption,
  type FormFieldSpec,
} from '@/lib/resources/forms';
import {
  formatInstructor,
  formatSharingScope,
  formatTimeRange,
  formatWeekday,
} from '@/lib/resources/formatters';
import {
  instructorAccessRow,
  instructorAvailabilityRow,
  instructorPreferenceRow,
  instructorRow,
  resourceCollegeAdmin,
  resourceDepartmentAdmin,
  teachingAssignmentRow,
} from '@/test/resource-fixtures';

const DEPARTMENT_OPTIONS: FieldOption[] = [
  { value: '2', label: 'BIOAI — Biomedical AI' },
  { value: '99', label: 'CS — Computer Science' },
];
const SEMESTER_OPTIONS: FieldOption[] = [{ value: '8', label: '2026–2027 · First' }];
const INSTRUCTOR_OPTIONS: FieldOption[] = [{ value: '1', label: 'Rana Salim (I-1042)' }];

function field(fields: readonly FormFieldSpec[], name: string): FormFieldSpec {
  const found = fields.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(`Field "${name}" is not part of the form.`);
  }
  return found;
}

function fieldNames(fields: readonly FormFieldSpec[]): string[] {
  return fields.map((candidate) => candidate.name);
}

describe('instructor profile form', () => {
  const collegeFields = instructorFields(DEPARTMENT_OPTIONS, true);
  const departmentFields = instructorFields(DEPARTMENT_OPTIONS, false);

  it('offers the three sharing scopes with their labels', () => {
    expect(SHARING_SCOPE_OPTIONS).toEqual([
      { value: 'PRIVATE', label: 'Private' },
      { value: 'SELECTED_DEPARTMENTS', label: 'Selected departments' },
      { value: 'COLLEGE_WIDE', label: 'College-wide' },
    ]);
    expect(field(collegeFields, 'sharing_scope').options).toEqual(SHARING_SCOPE_OPTIONS);
  });

  it('never renders an account-linking control', () => {
    // The accepted backend exposes no way to list eligible accounts, so no
    // free-form or guessed user id field may exist.
    expect(fieldNames(collegeFields)).not.toContain('user');
    expect(fieldNames(departmentFields)).not.toContain('user');
    expect(ACCOUNT_LINKING_NOTICE).toContain('not available');
  });

  it('fixes the primary department for a department administrator', () => {
    expect(field(departmentFields, 'primary_department').locked).toBe(true);
    expect(field(collegeFields, 'primary_department').locked).toBe(false);

    const context = buildFormContext(resourceDepartmentAdmin);
    expect(instructorFormValues(null, context).primary_department).toBe('2');
  });

  it('submits optional workload limits and keeps blank as null', () => {
    const values = instructorFormValues(instructorRow(), buildFormContext(resourceCollegeAdmin));
    const payload = instructorPayload(values);

    expect(payload.max_weekly_hours).toBe('18.00');
    expect(payload.max_daily_hours).toBe('5.00');
    expect(payload.sharing_scope).toBe('PRIVATE');
    expect(payload.staff_code).toBe('I-1042');
  });

  it('normalises a blank staff code to null and never sends a user id', () => {
    const payload = instructorPayload({
      full_name: 'Rana Salim',
      staff_code: '   ',
      academic_title: '',
      primary_department: '2',
      sharing_scope: 'SELECTED_DEPARTMENTS',
      max_weekly_hours: '',
      max_daily_hours: '',
      is_active: 'true',
    });

    expect(payload.staff_code).toBeNull();
    expect(payload.max_weekly_hours).toBeNull();
    expect(payload.max_daily_hours).toBeNull();
    expect(Object.keys(payload)).not.toContain('user');
  });

  it('requires workload limits above zero', () => {
    expect(
      field(collegeFields, 'max_weekly_hours').validate?.('0', {
        max_weekly_hours: '0',
        max_daily_hours: '',
      }),
    ).toBe('Workload limits must be greater than zero.');
    expect(
      field(collegeFields, 'max_weekly_hours').validate?.('abc', {
        max_weekly_hours: 'abc',
        max_daily_hours: '',
      }),
    ).toBe('Enter hours as a number with up to two decimals.');
    expect(
      field(collegeFields, 'max_weekly_hours').validate?.('', {
        max_weekly_hours: '',
        max_daily_hours: '',
      }),
    ).toBeNull();
  });

  it('refuses a daily limit above the weekly limit', () => {
    expect(
      field(collegeFields, 'max_daily_hours').validate?.('6', {
        max_weekly_hours: '5.00',
        max_daily_hours: '6',
      }),
    ).toBe('The daily hour limit cannot exceed the weekly hour limit.');
    expect(
      field(collegeFields, 'max_daily_hours').validate?.('5', {
        max_weekly_hours: '5.00',
        max_daily_hours: '5',
      }),
    ).toBeNull();
  });

  it('reads only the workload limits, keeping the rest of the row intact', () => {
    const values = instructorFormValues(instructorRow(), buildFormContext(resourceCollegeAdmin));
    expect(values).toMatchObject({
      full_name: 'Rana Salim',
      academic_title: 'Assistant Lecturer',
      sharing_scope: 'PRIVATE',
      is_active: 'true',
    });
    expect(values).not.toHaveProperty('user');
  });

  it('formats instructor and sharing values for display', () => {
    expect(formatInstructor({ id: 1, full_name: 'Rana Salim', staff_code: 'I-1042' })).toBe(
      'Rana Salim (I-1042)',
    );
    expect(formatInstructor({ id: 1, full_name: 'Rana Salim', staff_code: null })).toBe(
      'Rana Salim',
    );
    expect(formatSharingScope('SELECTED_DEPARTMENTS')).toBe('Selected departments');
  });
});

describe('instructor sharing form', () => {
  it('submits instructor, department and status as ids', () => {
    const payload = instructorAccessPayload(
      instructorAccessFormValues(instructorAccessRow()),
    );
    expect(payload).toEqual({ instructor: 1, department: 99, is_active: true });
  });

  it('explains that the primary department cannot be granted', () => {
    const departmentField = field(
      instructorAccessFields(INSTRUCTOR_OPTIONS, DEPARTMENT_OPTIONS),
      'department',
    );
    expect(departmentField.helpText).toContain('cannot be granted');
  });
});

describe('instructor availability form', () => {
  const fields = instructorAvailabilityFields(INSTRUCTOR_OPTIONS, SEMESTER_OPTIONS);

  it('states that availability is hard and absence is not unrestricted', () => {
    expect(AVAILABILITY_HARD_NOTICE).toContain('hard');
    expect(AVAILABILITY_HARD_NOTICE).toContain('never means the instructor is free');
    expect(field(fields, 'end_time').helpText).toBe(AVAILABILITY_HARD_NOTICE);
  });

  it('requires a semester, a weekday and an ordered window', () => {
    expect(field(fields, 'semester').validate?.('', {})).toBe('Semester is required.');
    expect(field(fields, 'day_of_week').validate?.('', {})).toBe('Weekday is required.');
    expect(
      field(fields, 'end_time').validate?.('08:00', {
        start_time: '08:00',
        end_time: '08:00',
      }),
    ).toBe('Availability end time must end after it starts.');
  });

  it('sends the weekday as the shared integer enum', () => {
    const payload = instructorAvailabilityPayload(
      instructorAvailabilityFormValues(instructorAvailabilityRow()),
    );
    expect(payload).toEqual({
      instructor: 1,
      semester: 8,
      day_of_week: 0,
      start_time: '08:00',
      end_time: '12:00',
      is_active: true,
    });
  });

  it('reads times back without seconds for a time input', () => {
    const values = instructorAvailabilityFormValues(
      instructorAvailabilityRow({ start_time: '08:30:00', end_time: '12:45:00' }),
    );
    expect(values.start_time).toBe('08:30');
    expect(values.end_time).toBe('12:45');
  });

  it('renders the weekday label from the shared enum', () => {
    expect(formatWeekday(instructorAvailabilityRow().day_of_week)).toBe('Sunday');
    expect(formatTimeRange('08:00:00', '12:00:00')).toBe('08:00–12:00');
  });
});

describe('instructor preference form', () => {
  const fields = instructorPreferenceFields(INSTRUCTOR_OPTIONS, SEMESTER_OPTIONS);

  it('offers preferred and avoid as soft preferences', () => {
    expect(field(fields, 'preference_type').options).toEqual([
      { value: 'PREFERRED', label: 'Preferred' },
      { value: 'AVOID', label: 'Avoid' },
    ]);
    expect(field(fields, 'preference_type').helpText).toBe(PREFERENCE_SOFT_NOTICE);
    expect(PREFERENCE_SOFT_NOTICE).toContain('not an unavailable period');
  });

  it('submits the preference type value', () => {
    const payload = instructorPreferencePayload(
      instructorPreferenceFormValues(instructorPreferenceRow()),
    );
    expect(payload.preference_type).toBe('AVOID');
    expect(payload.day_of_week).toBe(1);
  });

  it('reports a reversed preference window with its own wording', () => {
    expect(
      field(fields, 'end_time').validate?.('09:00', {
        start_time: '10:00',
        end_time: '09:00',
      }),
    ).toBe('Preference end time must end after it starts.');
  });
});

describe('teaching assignment form', () => {
  const fields = teachingAssignmentFields(INSTRUCTOR_OPTIONS, INSTRUCTOR_OPTIONS);

  it('offers primary and assistant and states the single-primary rule', () => {
    expect(field(fields, 'assignment_role').options).toEqual([
      { value: 'PRIMARY', label: 'Primary' },
      { value: 'ASSISTANT', label: 'Assistant' },
    ]);
    expect(SINGLE_PRIMARY_HINT).toContain('only one active primary instructor');
    expect(field(fields, 'assignment_role').helpText).toContain('one active primary');
  });

  it('says eligibility is rechecked by the server', () => {
    expect(field(fields, 'instructor').helpText).toContain('server checks this again');
  });

  it('submits component, instructor and role ids', () => {
    const payload = teachingAssignmentPayload(
      teachingAssignmentFormValues(teachingAssignmentRow()),
    );
    expect(payload).toEqual({
      teaching_component: 10,
      instructor: 1,
      assignment_role: 'PRIMARY',
      is_active: true,
    });
  });

  it('requires both the component and the instructor', () => {
    expect(field(fields, 'teaching_component').validate?.('', {})).toBe(
      'Teaching component is required.',
    );
    expect(field(fields, 'instructor').validate?.('', {})).toBe(
      'Instructor is required.',
    );
  });
});
