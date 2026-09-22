import { describe, expect, it } from 'vitest';

import { buildFormContext } from '@/lib/academic/forms';
import { ROOM_REQUIREMENT_DERIVED_NOTICE } from '@/lib/resources/constants';
import {
  roomAccessFields,
  roomAccessFormValues,
  roomAccessPayload,
  roomAvailabilityFields,
  roomAvailabilityFormValues,
  roomAvailabilityPayload,
  roomCapabilityAssignmentFields,
  roomCapabilityAssignmentFormValues,
  roomCapabilityAssignmentPayload,
  roomCapabilityFields,
  roomCapabilityFormValues,
  roomCapabilityPayload,
  roomFields,
  roomFormValues,
  roomOptions,
  roomPayload,
  roomRequirementCapabilityFields,
  roomRequirementCapabilityFormValues,
  roomRequirementCapabilityPayload,
  roomRequirementFields,
  roomRequirementFormValues,
  roomRequirementPayload,
  roomTypeFields,
  roomTypeFormValues,
  roomTypePayload,
  type FieldOption,
  type FormFieldSpec,
} from '@/lib/resources/forms';
import { formatRoom } from '@/lib/resources/formatters';
import {
  capabilityRequirementRow,
  roomAccessRow,
  roomAvailabilityRow,
  roomCapabilityAssignmentRow,
  roomCapabilityRow,
  roomRequirementRow,
  roomRow,
  roomTypeRow,
  resourceCollegeAdmin,
  resourceDepartmentAdmin,
} from '@/test/resource-fixtures';

const DEPARTMENT_OPTIONS: FieldOption[] = [
  { value: '2', label: 'BIOAI — Biomedical AI' },
  { value: '99', label: 'CS — Computer Science' },
];
const ROOM_TYPE_OPTIONS: FieldOption[] = [{ value: '20', label: 'LECTURE_HALL — Lecture hall' }];
const ROOM_OPTIONS: FieldOption[] = [{ value: '22', label: 'AI-LAB-1 — AI Lab (BIOAI)' }];
const CAPABILITY_OPTIONS: FieldOption[] = [{ value: '21', label: 'COMPUTERS — Computers' }];
const SEMESTER_OPTIONS: FieldOption[] = [{ value: '8', label: '2026–2027 · First' }];

function field(fields: readonly FormFieldSpec[], name: string): FormFieldSpec {
  const found = fields.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(`Field "${name}" is not part of the form.`);
  }
  return found;
}

describe('room vocabulary forms', () => {
  it('keeps room types and capabilities identical in shape', () => {
    expect(roomTypeFields().map((candidate) => candidate.name)).toEqual([
      'name',
      'code',
      'description',
      'is_active',
    ]);
    expect(roomCapabilityFields().map((candidate) => candidate.name)).toEqual([
      'name',
      'code',
      'description',
      'is_active',
    ]);
  });

  it('submits vocabulary rows', () => {
    expect(roomTypePayload(roomTypeFormValues(roomTypeRow()))).toEqual({
      name: 'Lecture hall',
      code: 'LECTURE_HALL',
      description: 'Tiered seating for lectures.',
      is_active: true,
    });
    expect(roomCapabilityPayload(roomCapabilityFormValues(roomCapabilityRow()))).toEqual({
      name: 'Computers',
      code: 'COMPUTERS',
      description: 'Student workstations.',
      is_active: true,
    });
  });
});

describe('room form', () => {
  const collegeFields = roomFields(DEPARTMENT_OPTIONS, ROOM_TYPE_OPTIONS, true);
  const departmentFields = roomFields(DEPARTMENT_OPTIONS, ROOM_TYPE_OPTIONS, false);

  it('requires capacity of at least one', () => {
    expect(field(collegeFields, 'capacity').validate?.('0', {})).toBe(
      'Capacity must be at least 1.',
    );
    expect(field(collegeFields, 'capacity').validate?.('', {})).toBe(
      'Capacity is required.',
    );
    expect(field(collegeFields, 'capacity').validate?.('30', {})).toBeNull();
  });

  it('offers the sharing scopes and a room type selector', () => {
    expect(field(collegeFields, 'sharing_scope').options?.map((option) => option.value)).toEqual(
      ['PRIVATE', 'SELECTED_DEPARTMENTS', 'COLLEGE_WIDE'],
    );
    expect(field(collegeFields, 'room_type').options).toEqual(ROOM_TYPE_OPTIONS);
  });

  it('fixes the owning department for a department administrator', () => {
    expect(field(departmentFields, 'owner_department').locked).toBe(true);
    expect(field(collegeFields, 'owner_department').locked).toBe(false);

    const context = buildFormContext(resourceDepartmentAdmin);
    expect(roomFormValues(null, context).owner_department).toBe('2');
  });

  it('submits the room with foreign keys as ids', () => {
    const values = roomFormValues(roomRow(), buildFormContext(resourceCollegeAdmin));
    expect(roomPayload(values)).toEqual({
      name: 'Artificial Intelligence Lab',
      code: 'AI-LAB-1',
      owner_department: 2,
      room_type: 20,
      capacity: 30,
      sharing_scope: 'PRIVATE',
      is_active: true,
    });
  });

  it('labels room options with their owner', () => {
    expect(roomOptions([roomRow()])[0]?.label).toBe('AI-LAB-1 — Artificial Intelligence Lab (BIOAI)');
    expect(formatRoom({ id: 22, name: 'Artificial Intelligence Lab', code: 'AI-LAB-1' })).toBe(
      'AI-LAB-1 — Artificial Intelligence Lab',
    );
  });
});

describe('room sharing form', () => {
  it('submits room, department and status', () => {
    expect(roomAccessPayload(roomAccessFormValues(roomAccessRow()))).toEqual({
      room: 22,
      department: 99,
      is_active: true,
    });
  });

  it('explains that the owning department cannot be granted', () => {
    expect(
      field(roomAccessFields(ROOM_OPTIONS, DEPARTMENT_OPTIONS), 'department').helpText,
    ).toContain('cannot be granted');
  });
});

describe('room capability assignment form', () => {
  const fields = roomCapabilityAssignmentFields(ROOM_OPTIONS, CAPABILITY_OPTIONS);

  it('has no status field because the relation has no active flag', () => {
    expect(fields.map((candidate) => candidate.name)).toEqual(['room', 'capability']);
  });

  it('submits the relationship ids only', () => {
    expect(
      roomCapabilityAssignmentPayload(
        roomCapabilityAssignmentFormValues(roomCapabilityAssignmentRow()),
      ),
    ).toEqual({ room: 22, capability: 21 });
  });
});

describe('room availability form', () => {
  const fields = roomAvailabilityFields(ROOM_OPTIONS, SEMESTER_OPTIONS);

  it('requires a room, semester, weekday and ordered window', () => {
    expect(field(fields, 'room').validate?.('', {})).toBe('Room is required.');
    expect(field(fields, 'semester').validate?.('', {})).toBe('Semester is required.');
    expect(field(fields, 'day_of_week').validate?.('', {})).toBe('Weekday is required.');
    expect(
      field(fields, 'end_time').validate?.('07:00', {
        start_time: '08:00',
        end_time: '07:00',
      }),
    ).toBe('Availability end time must end after it starts.');
  });

  it('states that availability is hard', () => {
    expect(field(fields, 'end_time').helpText).toContain('hard constraints');
  });

  it('submits the window with the weekday as an integer', () => {
    expect(roomAvailabilityPayload(roomAvailabilityFormValues(roomAvailabilityRow()))).toEqual({
      room: 22,
      semester: 8,
      day_of_week: 0,
      start_time: '08:00',
      end_time: '16:00',
      is_active: true,
    });
  });
});

describe('room requirement form', () => {
  const fields = roomRequirementFields(ROOM_OPTIONS, ROOM_TYPE_OPTIONS);

  it('never submits derived values', () => {
    const payload = roomRequirementPayload(roomRequirementFormValues(roomRequirementRow()));
    expect(payload).toEqual({
      teaching_component: 10,
      required_room_type: 20,
      minimum_capacity: 40,
      is_active: true,
    });
    expect(Object.keys(payload)).not.toContain('expected_student_count');
    expect(Object.keys(payload)).not.toContain('effective_minimum_capacity');
    expect(Object.keys(payload)).not.toContain('required_capabilities');
    expect(Object.keys(payload)).not.toContain('id');
  });

  it('keeps the optional override blank as null', () => {
    const payload = roomRequirementPayload({
      teaching_component: '10',
      required_room_type: '',
      minimum_capacity: '',
      is_active: 'true',
    });
    expect(payload.required_room_type).toBeNull();
    expect(payload.minimum_capacity).toBeNull();
  });

  it('validates the optional minimum capacity', () => {
    expect(field(fields, 'minimum_capacity').validate?.('0', {})).toBe(
      'Minimum capacity must be greater than zero.',
    );
    expect(field(fields, 'minimum_capacity').validate?.('', {})).toBeNull();
  });

  it('explains that the effective minimum is derived', () => {
    expect(ROOM_REQUIREMENT_DERIVED_NOTICE).toContain('derived by the server');
    expect(field(fields, 'minimum_capacity').helpText).toContain('expected student count decides');
  });

  it('renders the read-only derived values from a row', () => {
    const requirement = roomRequirementRow();
    expect(requirement.expected_student_count).toBe(35);
    expect(requirement.effective_minimum_capacity).toBe(40);
    expect(requirement.required_capabilities.map((capability) => capability.code)).toEqual([
      'COMPUTERS',
    ]);
  });
});

describe('required capability form', () => {
  const fields = roomRequirementCapabilityFields(ROOM_OPTIONS, CAPABILITY_OPTIONS);

  it('has no status field and exposes no removal', () => {
    expect(fields.map((candidate) => candidate.name)).toEqual([
      'room_requirement',
      'capability',
    ]);
    expect(fields.map((candidate) => candidate.name)).not.toContain('delete');
  });

  it('submits the relationship ids only', () => {
    expect(
      roomRequirementCapabilityPayload(
        roomRequirementCapabilityFormValues(capabilityRequirementRow()),
      ),
    ).toEqual({ room_requirement: 26, capability: 21 });
  });

  it('reads the nested requirement summary', () => {
    expect(capabilityRequirementRow().room_requirement.id).toBe(26);
    expect(capabilityRequirementRow().room_requirement.minimum_capacity).toBe(40);
  });
});
