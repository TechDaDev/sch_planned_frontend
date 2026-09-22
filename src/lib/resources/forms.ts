/**
 * Declarative form definitions for instructors, rooms and calendar resources.
 *
 * Same pattern as the academic layer: field specifications plus pure
 * `formValues`/`payload` functions, so form behaviour is unit-testable without
 * rendering and no display label can leak into a request body.
 *
 * Times are submitted as `HH:MM` wall-clock values (the backend's `TimeField`
 * accepts the ISO form) and are never converted through a timezone.
 */

import type { FormContext, FormFieldSpec, FieldOption } from '@/lib/academic/forms';
import { toOptions } from '@/lib/academic/forms';
import type { DepartmentSummary } from '@/lib/academic/types';
import {
  isBlank,
  readBoolean,
  readOptionalId,
  readRequiredId,
  readText,
  type FormValues,
} from '@/lib/form-values';
import {
  ASSIGNMENT_ROLE_OPTIONS,
  AVAILABILITY_HARD_NOTICE,
  EXCEPTION_SCOPE_OPTIONS,
  EXCEPTION_TYPE_OPTIONS,
  PREFERENCE_TYPE_OPTIONS,
  PREFERENCE_SOFT_NOTICE,
  SHARING_SCOPE_OPTIONS,
  WEEKDAY_OPTIONS,
} from '@/lib/resources/constants';
import { effectiveScopeFor, requiredScopeFor } from '@/lib/resources/calendar';
import { formatTimeRange } from '@/lib/resources/formatters';
import type {
  AssignmentRole,
  BreakPeriod,
  BreakPeriodWrite,
  CalendarException,
  CalendarExceptionWrite,
  ExceptionScope,
  ExceptionType,
  InstructorAvailability,
  InstructorAvailabilityWrite,
  InstructorDepartmentAccess,
  InstructorDepartmentAccessWrite,
  InstructorPreference,
  InstructorPreferenceWrite,
  InstructorProfile,
  InstructorProfileWrite,
  PreferenceType,
  Room,
  RoomAvailability,
  RoomAvailabilityWrite,
  RoomCapability,
  RoomCapabilityAssignment,
  RoomCapabilityAssignmentWrite,
  RoomCapabilityWrite,
  RoomDepartmentAccess,
  RoomDepartmentAccessWrite,
  RoomType,
  RoomTypeWrite,
  RoomWrite,
  SharingScope,
  TeachingAssignment,
  TeachingAssignmentWrite,
  TeachingComponentCapabilityRequirement,
  TeachingComponentCapabilityRequirementWrite,
  TeachingComponentRoomRequirement,
  TeachingComponentRoomRequirementWrite,
  TimeSlot,
  TimeSlotWrite,
  Weekday,
  WorkingDay,
  WorkingDayWrite,
} from '@/lib/resources/types';
import {
  optionalInteger,
  validateCapacity,
  validateMinimumCapacity,
  validateSequence,
  validateTimeWindow,
  validateWorkloadLimits,
  workloadValue,
} from '@/lib/resources/validation';

export type { FormContext, FormFieldSpec, FieldOption } from '@/lib/academic/forms';
export type { FormValues } from '@/lib/form-values';

// --- Option builders ------------------------------------------------------

export function instructorOptions(
  instructors: readonly InstructorProfile[],
): FieldOption[] {
  return instructors.map((instructor) => ({
    value: String(instructor.id),
    label: instructor.staff_code
      ? `${instructor.full_name} (${instructor.staff_code}) — ${instructor.primary_department.code}`
      : `${instructor.full_name} — ${instructor.primary_department.code}`,
  }));
}

export function roomOptions(rooms: readonly Room[]): FieldOption[] {
  return rooms.map((room) => ({
    value: String(room.id),
    label: `${room.code} — ${room.name} (${room.owner_department.code})`,
  }));
}

export function roomTypeOptions(roomTypes: readonly RoomType[]): FieldOption[] {
  return toOptions(
    roomTypes,
    (roomType) => roomType.id,
    (roomType) => `${roomType.code} — ${roomType.name}`,
  );
}

export function roomCapabilityOptions(
  capabilities: readonly RoomCapability[],
): FieldOption[] {
  return toOptions(
    capabilities,
    (capability) => capability.id,
    (capability) => `${capability.code} — ${capability.name}`,
  );
}

/** `2026–2027 · First — Sunday 08:00–16:00`. */
export function workingDayOptions(days: readonly WorkingDay[]): FieldOption[] {
  return days.map((day) => ({
    value: String(day.id),
    label: `${day.semester.academic_year.start_year}–${day.semester.academic_year.end_year} · ${
      day.semester.number === 1 ? 'First' : 'Second'
    } — ${day.day_of_week_display} ${formatTimeRange(day.start_time, day.end_time)}`,
  }));
}

/** Room requirement rows keyed by their teaching component context. */
export function roomRequirementOptions(
  requirements: readonly TeachingComponentRoomRequirement[],
): FieldOption[] {
  return requirements.map((requirement) => ({
    value: String(requirement.id),
    label: `${requirement.teaching_component.component_type === 'THEORY' ? 'Theory' : 'Practical'}${
      requirement.teaching_component.label ? ` (${requirement.teaching_component.label})` : ''
    } — requirement ${requirement.id}`,
  }));
}

export function departmentOptionLabel(department: DepartmentSummary): string {
  return `${department.code} — ${department.name}`;
}

// --- Instructor profile ---------------------------------------------------

export function instructorFields(
  departmentOptionList: readonly FieldOption[],
  isCollegeAdmin: boolean,
): FormFieldSpec[] {
  return [
    {
      name: 'full_name',
      label: 'Full name',
      kind: 'text',
      required: true,
      placeholder: 'Rana Salim',
      validate: (value) => (value.trim().length === 0 ? 'Full name is required.' : null),
    },
    {
      name: 'staff_code',
      label: 'Staff code',
      kind: 'text',
      placeholder: 'I-1042',
      helpText: 'Optional institutional identifier. Leave blank when unused.',
    },
    {
      name: 'academic_title',
      label: 'Academic title',
      kind: 'text',
      placeholder: 'Assistant Lecturer',
    },
    {
      name: 'primary_department',
      label: 'Primary department',
      kind: 'select',
      required: true,
      options: departmentOptionList,
      locked: !isCollegeAdmin,
      lockedReason: 'Instructors are owned by your own department.',
      validate: (value) => (value.trim().length === 0 ? 'Primary department is required.' : null),
    },
    {
      name: 'sharing_scope',
      label: 'Sharing scope',
      kind: 'select',
      required: true,
      options: SHARING_SCOPE_OPTIONS,
      validate: (value) => (value.trim().length === 0 ? 'Sharing scope is required.' : null),
    },
    {
      name: 'max_weekly_hours',
      label: 'Maximum weekly hours',
      kind: 'decimal',
      helpText: 'Optional. Leave blank for no limit.',
      validate: (value, values) =>
        validateWorkloadLimits(value, values.max_daily_hours ?? '').errors.max_weekly_hours ??
        null,
    },
    {
      name: 'max_daily_hours',
      label: 'Maximum daily hours',
      kind: 'decimal',
      helpText: 'Optional. Cannot exceed the weekly limit.',
      validate: (value, values) =>
        validateWorkloadLimits(values.max_weekly_hours ?? '', value).errors.max_daily_hours ??
        null,
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function instructorFormValues(
  instructor: InstructorProfile | null,
  context: FormContext,
): FormValues {
  // A locked department select must still carry a value, or the form could never
  // be submitted: department administrators always create inside their own
  // department.
  const fallbackDepartment =
    context.ownDepartmentId === null ? '' : String(context.ownDepartmentId);
  return {
    full_name: instructor?.full_name ?? '',
    staff_code: instructor?.staff_code ?? '',
    academic_title: instructor?.academic_title ?? '',
    primary_department: instructor
      ? String(instructor.primary_department.id)
      : fallbackDepartment,
    sharing_scope: instructor?.sharing_scope ?? 'PRIVATE',
    max_weekly_hours: instructor?.max_weekly_hours ?? '',
    max_daily_hours: instructor?.max_daily_hours ?? '',
    is_active: String(instructor?.is_active ?? true),
  };
}

/**
 * Instructor payload.
 *
 * `user` is deliberately never included: F2 offers no supported way to discover
 * an eligible account, so an existing link is preserved by omission.
 */
export function instructorPayload(values: FormValues): InstructorProfileWrite {
  return {
    full_name: readText(values, 'full_name'),
    staff_code: isBlank(values, 'staff_code') ? null : readText(values, 'staff_code'),
    academic_title: readText(values, 'academic_title'),
    primary_department: readRequiredId(values, 'primary_department'),
    sharing_scope: readText(values, 'sharing_scope') as SharingScope,
    max_weekly_hours: workloadValue(values.max_weekly_hours ?? ''),
    max_daily_hours: workloadValue(values.max_daily_hours ?? ''),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Instructor sharing ---------------------------------------------------

export function instructorAccessFields(
  instructorOptionList: readonly FieldOption[],
  departmentOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'instructor',
      label: 'Instructor',
      kind: 'select',
      required: true,
      options: instructorOptionList,
      helpText: 'Only instructors owned by your department can be shared.',
      validate: (value) => (value.trim().length === 0 ? 'Instructor is required.' : null),
    },
    {
      name: 'department',
      label: 'Department granted access',
      kind: 'select',
      required: true,
      options: departmentOptionList,
      helpText:
        'The primary department already has inherent access, so it cannot be granted explicitly.',
      validate: (value) => (value.trim().length === 0 ? 'Department is required.' : null),
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function instructorAccessFormValues(
  access: InstructorDepartmentAccess | null,
): FormValues {
  return {
    instructor: access ? String(access.instructor.id) : '',
    department: access ? String(access.department.id) : '',
    is_active: String(access?.is_active ?? true),
  };
}

export function instructorAccessPayload(
  values: FormValues,
): InstructorDepartmentAccessWrite {
  return {
    instructor: readRequiredId(values, 'instructor'),
    department: readRequiredId(values, 'department'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Instructor availability ---------------------------------------------

export function instructorAvailabilityFields(
  instructorOptionList: readonly FieldOption[],
  semesterOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'instructor',
      label: 'Instructor',
      kind: 'select',
      required: true,
      options: instructorOptionList,
      validate: (value) => (value.trim().length === 0 ? 'Instructor is required.' : null),
    },
    {
      name: 'semester',
      label: 'Semester',
      kind: 'select',
      required: true,
      options: semesterOptionList,
      validate: (value) => (value.trim().length === 0 ? 'Semester is required.' : null),
    },
    {
      name: 'day_of_week',
      label: 'Weekday',
      kind: 'select',
      required: true,
      options: WEEKDAY_OPTIONS,
      validate: (value) => (value.trim().length === 0 ? 'Weekday is required.' : null),
    },
    {
      name: 'start_time',
      label: 'Available from',
      kind: 'time',
      required: true,
      validate: (value, values) =>
        validateTimeWindow(
          value,
          values.end_time ?? '',
          { endMessage: 'Availability end time must end after it starts.' },
        ).errors.start_time ?? null,
    },
    {
      name: 'end_time',
      label: 'Available until',
      kind: 'time',
      required: true,
      helpText: AVAILABILITY_HARD_NOTICE,
      validate: (value, values) =>
        validateTimeWindow(
          values.start_time ?? '',
          value,
          { endMessage: 'Availability end time must end after it starts.' },
        ).errors.end_time ?? null,
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function instructorAvailabilityFormValues(
  availability: InstructorAvailability | null,
): FormValues {
  return {
    instructor: availability ? String(availability.instructor.id) : '',
    semester: availability ? String(availability.semester.id) : '',
    day_of_week: availability ? String(availability.day_of_week) : '',
    start_time: availability ? availability.start_time.slice(0, 5) : '',
    end_time: availability ? availability.end_time.slice(0, 5) : '',
    is_active: String(availability?.is_active ?? true),
  };
}

export function instructorAvailabilityPayload(
  values: FormValues,
): InstructorAvailabilityWrite {
  return {
    instructor: readRequiredId(values, 'instructor'),
    semester: readRequiredId(values, 'semester'),
    day_of_week: Number(readText(values, 'day_of_week')) as Weekday,
    start_time: readText(values, 'start_time'),
    end_time: readText(values, 'end_time'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Instructor preferences ----------------------------------------------

export function instructorPreferenceFields(
  instructorOptionList: readonly FieldOption[],
  semesterOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'instructor',
      label: 'Instructor',
      kind: 'select',
      required: true,
      options: instructorOptionList,
      validate: (value) => (value.trim().length === 0 ? 'Instructor is required.' : null),
    },
    {
      name: 'semester',
      label: 'Semester',
      kind: 'select',
      required: true,
      options: semesterOptionList,
      validate: (value) => (value.trim().length === 0 ? 'Semester is required.' : null),
    },
    {
      name: 'day_of_week',
      label: 'Weekday',
      kind: 'select',
      required: true,
      options: WEEKDAY_OPTIONS,
      validate: (value) => (value.trim().length === 0 ? 'Weekday is required.' : null),
    },
    {
      name: 'preference_type',
      label: 'Preference',
      kind: 'select',
      required: true,
      options: PREFERENCE_TYPE_OPTIONS,
      helpText: PREFERENCE_SOFT_NOTICE,
      validate: (value) => (value.trim().length === 0 ? 'Preference is required.' : null),
    },
    {
      name: 'start_time',
      label: 'From',
      kind: 'time',
      required: true,
      validate: (value, values) =>
        validateTimeWindow(value, values.end_time ?? '', {
          endMessage: 'Preference end time must end after it starts.',
        }).errors.start_time ?? null,
    },
    {
      name: 'end_time',
      label: 'Until',
      kind: 'time',
      required: true,
      validate: (value, values) =>
        validateTimeWindow(values.start_time ?? '', value, {
          endMessage: 'Preference end time must end after it starts.',
        }).errors.end_time ?? null,
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function instructorPreferenceFormValues(
  preference: InstructorPreference | null,
): FormValues {
  return {
    instructor: preference ? String(preference.instructor.id) : '',
    semester: preference ? String(preference.semester.id) : '',
    day_of_week: preference ? String(preference.day_of_week) : '',
    preference_type: preference?.preference_type ?? 'PREFERRED',
    start_time: preference ? preference.start_time.slice(0, 5) : '',
    end_time: preference ? preference.end_time.slice(0, 5) : '',
    is_active: String(preference?.is_active ?? true),
  };
}

export function instructorPreferencePayload(
  values: FormValues,
): InstructorPreferenceWrite {
  return {
    instructor: readRequiredId(values, 'instructor'),
    semester: readRequiredId(values, 'semester'),
    day_of_week: Number(readText(values, 'day_of_week')) as Weekday,
    start_time: readText(values, 'start_time'),
    end_time: readText(values, 'end_time'),
    preference_type: readText(values, 'preference_type') as PreferenceType,
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Teaching assignments -------------------------------------------------

export function teachingAssignmentFields(
  componentOptionList: readonly FieldOption[],
  instructorOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'teaching_component',
      label: 'Teaching component',
      kind: 'select',
      required: true,
      options: componentOptionList,
      helpText: 'Only components managed by your department can be staffed.',
      validate: (value) => (value.trim().length === 0 ? 'Teaching component is required.' : null),
    },
    {
      name: 'instructor',
      label: 'Instructor',
      kind: 'select',
      required: true,
      options: instructorOptionList,
      helpText:
        'The instructor must be active and eligible for the managing department; the server checks this again.',
      validate: (value) => (value.trim().length === 0 ? 'Instructor is required.' : null),
    },
    {
      name: 'assignment_role',
      label: 'Role',
      kind: 'select',
      required: true,
      options: ASSIGNMENT_ROLE_OPTIONS,
      helpText: 'A component can have only one active primary instructor.',
      validate: (value) => (value.trim().length === 0 ? 'Role is required.' : null),
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function teachingAssignmentFormValues(
  assignment: TeachingAssignment | null,
): FormValues {
  return {
    teaching_component: assignment ? String(assignment.teaching_component.id) : '',
    instructor: assignment ? String(assignment.instructor.id) : '',
    assignment_role: assignment?.assignment_role ?? 'PRIMARY',
    is_active: String(assignment?.is_active ?? true),
  };
}

export function teachingAssignmentPayload(
  values: FormValues,
): TeachingAssignmentWrite {
  return {
    teaching_component: readRequiredId(values, 'teaching_component'),
    instructor: readRequiredId(values, 'instructor'),
    assignment_role: readText(values, 'assignment_role') as AssignmentRole,
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Room vocabulary ------------------------------------------------------

export function roomTypeFields(): FormFieldSpec[] {
  return [
    {
      name: 'name',
      label: 'Name',
      kind: 'text',
      required: true,
      placeholder: 'Lecture hall',
      validate: (value) => (value.trim().length === 0 ? 'Name is required.' : null),
    },
    {
      name: 'code',
      label: 'Code',
      kind: 'text',
      required: true,
      placeholder: 'LECTURE_HALL',
      validate: (value) => (value.trim().length === 0 ? 'Code is required.' : null),
    },
    { name: 'description', label: 'Description', kind: 'textarea' },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function roomTypeFormValues(roomType: RoomType | null): FormValues {
  return {
    name: roomType?.name ?? '',
    code: roomType?.code ?? '',
    description: roomType?.description ?? '',
    is_active: String(roomType?.is_active ?? true),
  };
}

export function roomTypePayload(values: FormValues): RoomTypeWrite {
  return {
    name: readText(values, 'name'),
    code: readText(values, 'code'),
    description: values.description ?? '',
    is_active: readBoolean(values, 'is_active', true),
  };
}

export function roomCapabilityFields(): FormFieldSpec[] {
  return [
    {
      name: 'name',
      label: 'Name',
      kind: 'text',
      required: true,
      placeholder: 'Computers',
      validate: (value) => (value.trim().length === 0 ? 'Name is required.' : null),
    },
    {
      name: 'code',
      label: 'Code',
      kind: 'text',
      required: true,
      placeholder: 'COMPUTERS',
      validate: (value) => (value.trim().length === 0 ? 'Code is required.' : null),
    },
    { name: 'description', label: 'Description', kind: 'textarea' },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function roomCapabilityFormValues(capability: RoomCapability | null): FormValues {
  return {
    name: capability?.name ?? '',
    code: capability?.code ?? '',
    description: capability?.description ?? '',
    is_active: String(capability?.is_active ?? true),
  };
}

export function roomCapabilityPayload(values: FormValues): RoomCapabilityWrite {
  return {
    name: readText(values, 'name'),
    code: readText(values, 'code'),
    description: values.description ?? '',
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Room -----------------------------------------------------------------

export function roomFields(
  departmentOptionList: readonly FieldOption[],
  roomTypeOptionList: readonly FieldOption[],
  isCollegeAdmin: boolean,
): FormFieldSpec[] {
  return [
    {
      name: 'name',
      label: 'Name',
      kind: 'text',
      required: true,
      placeholder: 'Artificial Intelligence Lab',
      validate: (value) => (value.trim().length === 0 ? 'Name is required.' : null),
    },
    {
      name: 'code',
      label: 'Code',
      kind: 'text',
      required: true,
      placeholder: 'AI-LAB-1',
      helpText: 'Globally unique physical room code.',
      validate: (value) => (value.trim().length === 0 ? 'Code is required.' : null),
    },
    {
      name: 'owner_department',
      label: 'Owning department',
      kind: 'select',
      required: true,
      options: departmentOptionList,
      locked: !isCollegeAdmin,
      lockedReason: 'Rooms are owned by your own department.',
      validate: (value) => (value.trim().length === 0 ? 'Owning department is required.' : null),
    },
    {
      name: 'room_type',
      label: 'Room type',
      kind: 'select',
      required: true,
      options: roomTypeOptionList,
      validate: (value) => (value.trim().length === 0 ? 'Room type is required.' : null),
    },
    {
      name: 'capacity',
      label: 'Capacity',
      kind: 'integer',
      required: true,
      placeholder: '30',
      helpText: 'Number of students the room can host; at least 1.',
      validate: (value) => validateCapacity(value),
    },
    {
      name: 'sharing_scope',
      label: 'Sharing scope',
      kind: 'select',
      required: true,
      options: SHARING_SCOPE_OPTIONS,
      validate: (value) => (value.trim().length === 0 ? 'Sharing scope is required.' : null),
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function roomFormValues(room: Room | null, context: FormContext): FormValues {
  const fallbackDepartment =
    context.ownDepartmentId === null ? '' : String(context.ownDepartmentId);
  return {
    name: room?.name ?? '',
    code: room?.code ?? '',
    owner_department: room ? String(room.owner_department.id) : fallbackDepartment,
    room_type: room ? String(room.room_type.id) : '',
    capacity: room ? String(room.capacity) : '',
    sharing_scope: room?.sharing_scope ?? 'PRIVATE',
    is_active: String(room?.is_active ?? true),
  };
}

export function roomPayload(values: FormValues): RoomWrite {
  return {
    name: readText(values, 'name'),
    code: readText(values, 'code'),
    owner_department: readRequiredId(values, 'owner_department'),
    room_type: readRequiredId(values, 'room_type'),
    capacity: Number(readText(values, 'capacity')),
    sharing_scope: readText(values, 'sharing_scope') as SharingScope,
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Room sharing ---------------------------------------------------------

export function roomAccessFields(
  roomOptionList: readonly FieldOption[],
  departmentOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'room',
      label: 'Room',
      kind: 'select',
      required: true,
      options: roomOptionList,
      helpText: 'Only rooms owned by your department can be shared.',
      validate: (value) => (value.trim().length === 0 ? 'Room is required.' : null),
    },
    {
      name: 'department',
      label: 'Department granted access',
      kind: 'select',
      required: true,
      options: departmentOptionList,
      helpText:
        'The owning department already has access, so it cannot be granted explicitly.',
      validate: (value) => (value.trim().length === 0 ? 'Department is required.' : null),
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function roomAccessFormValues(access: RoomDepartmentAccess | null): FormValues {
  return {
    room: access ? String(access.room.id) : '',
    department: access ? String(access.department.id) : '',
    is_active: String(access?.is_active ?? true),
  };
}

export function roomAccessPayload(values: FormValues): RoomDepartmentAccessWrite {
  return {
    room: readRequiredId(values, 'room'),
    department: readRequiredId(values, 'department'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Room capability assignments -----------------------------------------

export function roomCapabilityAssignmentFields(
  roomOptionList: readonly FieldOption[],
  capabilityOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'room',
      label: 'Room',
      kind: 'select',
      required: true,
      options: roomOptionList,
      validate: (value) => (value.trim().length === 0 ? 'Room is required.' : null),
    },
    {
      name: 'capability',
      label: 'Capability',
      kind: 'select',
      required: true,
      options: capabilityOptionList,
      helpText: 'This link has no active flag: it is either present or not.',
      validate: (value) => (value.trim().length === 0 ? 'Capability is required.' : null),
    },
  ];
}

export function roomCapabilityAssignmentFormValues(
  assignment: RoomCapabilityAssignment | null,
): FormValues {
  return {
    room: assignment ? String(assignment.room.id) : '',
    capability: assignment ? String(assignment.capability.id) : '',
  };
}

export function roomCapabilityAssignmentPayload(
  values: FormValues,
): RoomCapabilityAssignmentWrite {
  return {
    room: readRequiredId(values, 'room'),
    capability: readRequiredId(values, 'capability'),
  };
}

// --- Room availability ----------------------------------------------------

export function roomAvailabilityFields(
  roomOptionList: readonly FieldOption[],
  semesterOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'room',
      label: 'Room',
      kind: 'select',
      required: true,
      options: roomOptionList,
      validate: (value) => (value.trim().length === 0 ? 'Room is required.' : null),
    },
    {
      name: 'semester',
      label: 'Semester',
      kind: 'select',
      required: true,
      options: semesterOptionList,
      validate: (value) => (value.trim().length === 0 ? 'Semester is required.' : null),
    },
    {
      name: 'day_of_week',
      label: 'Weekday',
      kind: 'select',
      required: true,
      options: WEEKDAY_OPTIONS,
      validate: (value) => (value.trim().length === 0 ? 'Weekday is required.' : null),
    },
    {
      name: 'start_time',
      label: 'Available from',
      kind: 'time',
      required: true,
      validate: (value, values) =>
        validateTimeWindow(value, values.end_time ?? '', {
          endMessage: 'Availability end time must end after it starts.',
        }).errors.start_time ?? null,
    },
    {
      name: 'end_time',
      label: 'Available until',
      kind: 'time',
      required: true,
      helpText:
        'Availability windows are hard constraints. No row for a weekday means availability is not configured.',
      validate: (value, values) =>
        validateTimeWindow(values.start_time ?? '', value, {
          endMessage: 'Availability end time must end after it starts.',
        }).errors.end_time ?? null,
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function roomAvailabilityFormValues(
  availability: RoomAvailability | null,
): FormValues {
  return {
    room: availability ? String(availability.room.id) : '',
    semester: availability ? String(availability.semester.id) : '',
    day_of_week: availability ? String(availability.day_of_week) : '',
    start_time: availability ? availability.start_time.slice(0, 5) : '',
    end_time: availability ? availability.end_time.slice(0, 5) : '',
    is_active: String(availability?.is_active ?? true),
  };
}

export function roomAvailabilityPayload(values: FormValues): RoomAvailabilityWrite {
  return {
    room: readRequiredId(values, 'room'),
    semester: readRequiredId(values, 'semester'),
    day_of_week: Number(readText(values, 'day_of_week')) as Weekday,
    start_time: readText(values, 'start_time'),
    end_time: readText(values, 'end_time'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Teaching component room requirements --------------------------------

export function roomRequirementFields(
  componentOptionList: readonly FieldOption[],
  roomTypeOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'teaching_component',
      label: 'Teaching component',
      kind: 'select',
      required: true,
      options: componentOptionList,
      helpText:
        'A component has at most one room requirement; only the managing department can write it.',
      validate: (value) => (value.trim().length === 0 ? 'Teaching component is required.' : null),
    },
    {
      name: 'required_room_type',
      label: 'Required room type',
      kind: 'select',
      options: roomTypeOptionList,
      helpText: 'Optional. Blank means no room-type restriction.',
    },
    {
      name: 'minimum_capacity',
      label: 'Minimum capacity',
      kind: 'integer',
      placeholder: '30',
      helpText:
        'Optional override. Blank means the expected student count decides; the server derives the effective minimum.',
      validate: (value) => validateMinimumCapacity(value),
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function roomRequirementFormValues(
  requirement: TeachingComponentRoomRequirement | null,
): FormValues {
  return {
    teaching_component: requirement ? String(requirement.teaching_component.id) : '',
    required_room_type: requirement?.required_room_type
      ? String(requirement.required_room_type.id)
      : '',
    minimum_capacity: requirement?.minimum_capacity === null || requirement?.minimum_capacity === undefined
      ? ''
      : String(requirement.minimum_capacity),
    is_active: String(requirement?.is_active ?? true),
  };
}

export function roomRequirementPayload(
  values: FormValues,
): TeachingComponentRoomRequirementWrite {
  // Derived values (expected_student_count, effective_minimum_capacity and the
  // required capabilities) are never submitted.
  return {
    teaching_component: readRequiredId(values, 'teaching_component'),
    required_room_type: readOptionalId(values, 'required_room_type'),
    minimum_capacity: optionalInteger(values.minimum_capacity ?? ''),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Required capabilities -----------------------------------------------

export function roomRequirementCapabilityFields(
  requirementOptionList: readonly FieldOption[],
  capabilityOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'room_requirement',
      label: 'Room requirement',
      kind: 'select',
      required: true,
      options: requirementOptionList,
      validate: (value) => (value.trim().length === 0 ? 'Room requirement is required.' : null),
    },
    {
      name: 'capability',
      label: 'Required capability',
      kind: 'select',
      required: true,
      options: capabilityOptionList,
      helpText: 'This link has no active flag; it is either required or not.',
      validate: (value) => (value.trim().length === 0 ? 'Capability is required.' : null),
    },
  ];
}

export function roomRequirementCapabilityFormValues(
  requirement: TeachingComponentCapabilityRequirement | null,
): FormValues {
  return {
    room_requirement: requirement ? String(requirement.room_requirement.id) : '',
    capability: requirement ? String(requirement.capability.id) : '',
  };
}

export function roomRequirementCapabilityPayload(
  values: FormValues,
): TeachingComponentCapabilityRequirementWrite {
  return {
    room_requirement: readRequiredId(values, 'room_requirement'),
    capability: readRequiredId(values, 'capability'),
  };
}

// --- Working days --------------------------------------------------------

export function workingDayFields(
  semesterOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'semester',
      label: 'Semester',
      kind: 'select',
      required: true,
      options: semesterOptionList,
      helpText:
        'One row per semester and weekday. Weekdays without a row are simply not schedulable.',
      validate: (value) => (value.trim().length === 0 ? 'Semester is required.' : null),
    },
    {
      name: 'day_of_week',
      label: 'Weekday',
      kind: 'select',
      required: true,
      options: WEEKDAY_OPTIONS,
      helpText: 'The college week runs Sunday to Thursday.',
      validate: (value) => (value.trim().length === 0 ? 'Weekday is required.' : null),
    },
    {
      name: 'start_time',
      label: 'Opens at',
      kind: 'time',
      required: true,
      validate: (value, values) =>
        validateTimeWindow(value, values.end_time ?? '', {
          endMessage: 'The working day must end after it starts.',
        }).errors.start_time ?? null,
    },
    {
      name: 'end_time',
      label: 'Closes at',
      kind: 'time',
      required: true,
      helpText:
        'Narrowing the window is rejected while active time slots or breaks fall outside it.',
      validate: (value, values) =>
        validateTimeWindow(values.start_time ?? '', value, {
          endMessage: 'The working day must end after it starts.',
        }).errors.end_time ?? null,
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function workingDayFormValues(workingDay: WorkingDay | null): FormValues {
  return {
    semester: workingDay ? String(workingDay.semester.id) : '',
    day_of_week: workingDay ? String(workingDay.day_of_week) : '',
    start_time: workingDay ? workingDay.start_time.slice(0, 5) : '',
    end_time: workingDay ? workingDay.end_time.slice(0, 5) : '',
    is_active: String(workingDay?.is_active ?? true),
  };
}

export function workingDayPayload(values: FormValues): WorkingDayWrite {
  return {
    semester: readRequiredId(values, 'semester'),
    day_of_week: Number(readText(values, 'day_of_week')) as Weekday,
    start_time: readText(values, 'start_time'),
    end_time: readText(values, 'end_time'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Time slots ----------------------------------------------------------

export function timeSlotFields(
  workingDayOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'working_day',
      label: 'Working day',
      kind: 'select',
      required: true,
      options: workingDayOptionList,
      helpText: 'A teaching period must fit inside its working day window.',
      validate: (value) => (value.trim().length === 0 ? 'Working day is required.' : null),
    },
    {
      name: 'sequence',
      label: 'Sequence',
      kind: 'integer',
      required: true,
      placeholder: '1',
      helpText: 'Order inside the day; 1 or greater, unique per working day.',
      validate: (value) => validateSequence(value),
    },
    {
      name: 'label',
      label: 'Label',
      kind: 'text',
      placeholder: 'Period 1',
      helpText: 'Optional. Durations may vary; no fixed length is assumed.',
    },
    {
      name: 'start_time',
      label: 'Starts at',
      kind: 'time',
      required: true,
      validate: (value, values) =>
        validateTimeWindow(value, values.end_time ?? '', {
          endMessage: 'The time slot must end after it starts.',
        }).errors.start_time ?? null,
    },
    {
      name: 'end_time',
      label: 'Ends at',
      kind: 'time',
      required: true,
      validate: (value, values) =>
        validateTimeWindow(values.start_time ?? '', value, {
          endMessage: 'The time slot must end after it starts.',
        }).errors.end_time ?? null,
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function timeSlotFormValues(timeSlot: TimeSlot | null): FormValues {
  return {
    working_day: timeSlot ? String(timeSlot.working_day.id) : '',
    sequence: timeSlot ? String(timeSlot.sequence) : '',
    label: timeSlot?.label ?? '',
    start_time: timeSlot ? timeSlot.start_time.slice(0, 5) : '',
    end_time: timeSlot ? timeSlot.end_time.slice(0, 5) : '',
    is_active: String(timeSlot?.is_active ?? true),
  };
}

export function timeSlotPayload(values: FormValues): TimeSlotWrite {
  return {
    working_day: readRequiredId(values, 'working_day'),
    sequence: Number(readText(values, 'sequence')),
    label: readText(values, 'label'),
    start_time: readText(values, 'start_time'),
    end_time: readText(values, 'end_time'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Break periods -------------------------------------------------------

export function breakPeriodFields(
  workingDayOptionList: readonly FieldOption[],
): FormFieldSpec[] {
  return [
    {
      name: 'working_day',
      label: 'Working day',
      kind: 'select',
      required: true,
      options: workingDayOptionList,
      validate: (value) => (value.trim().length === 0 ? 'Working day is required.' : null),
    },
    {
      name: 'name',
      label: 'Name',
      kind: 'text',
      required: true,
      placeholder: 'Lunch break',
      validate: (value) => (value.trim().length === 0 ? 'Name is required.' : null),
    },
    {
      name: 'start_time',
      label: 'Starts at',
      kind: 'time',
      required: true,
      helpText: 'A break must fit inside the day and must not overlap a teaching period.',
      validate: (value, values) =>
        validateTimeWindow(value, values.end_time ?? '', {
          endMessage: 'The break must end after it starts.',
        }).errors.start_time ?? null,
    },
    {
      name: 'end_time',
      label: 'Ends at',
      kind: 'time',
      required: true,
      validate: (value, values) =>
        validateTimeWindow(values.start_time ?? '', value, {
          endMessage: 'The break must end after it starts.',
        }).errors.end_time ?? null,
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

export function breakPeriodFormValues(breakPeriod: BreakPeriod | null): FormValues {
  return {
    working_day: breakPeriod ? String(breakPeriod.working_day.id) : '',
    name: breakPeriod?.name ?? '',
    start_time: breakPeriod ? breakPeriod.start_time.slice(0, 5) : '',
    end_time: breakPeriod ? breakPeriod.end_time.slice(0, 5) : '',
    is_active: String(breakPeriod?.is_active ?? true),
  };
}

export function breakPeriodPayload(values: FormValues): BreakPeriodWrite {
  return {
    working_day: readRequiredId(values, 'working_day'),
    name: readText(values, 'name'),
    start_time: readText(values, 'start_time'),
    end_time: readText(values, 'end_time'),
    is_active: readBoolean(values, 'is_active', true),
  };
}

// --- Calendar exceptions -------------------------------------------------

/** Target option lists, grouped by the scope that uses them. */
export interface ExceptionTargetOptions {
  departments: readonly FieldOption[];
  instructors: readonly FieldOption[];
  rooms: readonly FieldOption[];
  studentGroups: readonly FieldOption[];
}

export function calendarExceptionFields(
  semesterOptionList: readonly FieldOption[],
  scopeOptionList: readonly FieldOption[] = EXCEPTION_SCOPE_OPTIONS,
): FormFieldSpec[] {
  return [
    {
      name: 'semester',
      label: 'Semester',
      kind: 'select',
      required: true,
      options: semesterOptionList,
      validate: (value) => (value.trim().length === 0 ? 'Semester is required.' : null),
    },
    {
      name: 'date',
      label: 'Date',
      kind: 'date',
      required: true,
      validate: (value) => (value.trim().length === 0 ? 'Date is required.' : null),
    },
    {
      name: 'exception_type',
      label: 'Exception type',
      kind: 'select',
      required: true,
      options: EXCEPTION_TYPE_OPTIONS,
      validate: (value) => (value.trim().length === 0 ? 'Exception type is required.' : null),
    },
    {
      name: 'scope_type',
      label: 'Scope',
      kind: 'select',
      required: true,
      options: scopeOptionList,
      // Instructor absence is instructor-only and room closure is room-only, so
      // the scope is derived for those types instead of being chosen freely.
      locked: false,
      validate: (value) => (value.trim().length === 0 ? 'Scope is required.' : null),
    },
    {
      name: 'department',
      label: 'Department',
      kind: 'select',
      options: [],
      visible: (values) => values.scope_type === 'DEPARTMENT',
      validate: (value, values) =>
        values.scope_type === 'DEPARTMENT' && value.trim().length === 0
          ? 'Department is required for a department exception.'
          : null,
    },
    {
      name: 'instructor',
      label: 'Instructor',
      kind: 'select',
      options: [],
      visible: (values) => values.scope_type === 'INSTRUCTOR',
      validate: (value, values) =>
        values.scope_type === 'INSTRUCTOR' && value.trim().length === 0
          ? 'Instructor is required for an instructor exception.'
          : null,
    },
    {
      name: 'room',
      label: 'Room',
      kind: 'select',
      options: [],
      visible: (values) => values.scope_type === 'ROOM',
      validate: (value, values) =>
        values.scope_type === 'ROOM' && value.trim().length === 0
          ? 'Room is required for a room exception.'
          : null,
    },
    {
      name: 'student_group',
      label: 'Student group',
      kind: 'select',
      options: [],
      visible: (values) => values.scope_type === 'STUDENT_GROUP',
      validate: (value, values) =>
        values.scope_type === 'STUDENT_GROUP' && value.trim().length === 0
          ? 'Student group is required for a student group exception.'
          : null,
    },
    {
      name: 'title',
      label: 'Title',
      kind: 'text',
      required: true,
      placeholder: 'Founding day holiday',
      validate: (value) => (value.trim().length === 0 ? 'Title is required.' : null),
    },
    { name: 'description', label: 'Description', kind: 'textarea' },
    {
      name: 'is_full_day',
      label: 'Full day',
      kind: 'checkbox',
      helpText: 'Cleared, the exception needs both a start and an end time.',
    },
    {
      name: 'start_time',
      label: 'Starts at',
      kind: 'time',
      visible: (values) => values.is_full_day !== 'true',
      validate: (value, values) => {
        if (values.is_full_day === 'true') {
          return null;
        }
        return validateTimeWindow(value, values.end_time ?? '', {
          endMessage: 'The exception must end after it starts.',
        }).errors.start_time ?? null;
      },
    },
    {
      name: 'end_time',
      label: 'Ends at',
      kind: 'time',
      visible: (values) => values.is_full_day !== 'true',
      validate: (value, values) => {
        if (values.is_full_day === 'true') {
          return null;
        }
        return validateTimeWindow(values.start_time ?? '', value, {
          endMessage: 'The exception must end after it starts.',
        }).errors.end_time ?? null;
      },
    },
    { name: 'is_active', label: 'Active', kind: 'checkbox' },
  ];
}

/**
 * Switching the exception type can force a scope.
 *
 * Applied as a derivation so the form never submits a pair the backend pins.
 */
export function applyExceptionDerivation(
  name: string,
  value: string,
  values: FormValues,
): FormValues | null {
  if (name !== 'exception_type') {
    return null;
  }
  const scope = effectiveScopeFor(
    value as ExceptionType,
    readText(values, 'scope_type') as ExceptionScope,
  );
  if (values.scope_type === scope) {
    return null;
  }
  return { ...values, scope_type: scope };
}

export function calendarExceptionFormValues(
  exception: CalendarException | null,
): FormValues {
  const target = exception?.target ?? null;
  return {
    semester: exception ? String(exception.semester.id) : '',
    date: exception?.date ?? '',
    exception_type: exception?.exception_type ?? 'HOLIDAY',
    scope_type: exception?.scope_type ?? 'COLLEGE',
    department:
      exception?.scope_type === 'DEPARTMENT' && target ? String(target.id) : '',
    instructor:
      exception?.scope_type === 'INSTRUCTOR' && target ? String(target.id) : '',
    room: exception?.scope_type === 'ROOM' && target ? String(target.id) : '',
    student_group:
      exception?.scope_type === 'STUDENT_GROUP' && target ? String(target.id) : '',
    title: exception?.title ?? '',
    description: exception?.description ?? '',
    is_full_day: String(exception?.is_full_day ?? true),
    start_time: exception?.start_time ? exception.start_time.slice(0, 5) : '',
    end_time: exception?.end_time ? exception.end_time.slice(0, 5) : '',
    is_active: String(exception?.is_active ?? true),
  };
}

/**
 * Calendar exception payload.
 *
 * Only the target field matching the selected scope is ever sent; the other
 * target ids are omitted entirely so a change of scope cannot leave a stale id
 * behind.
 */
export function calendarExceptionPayload(values: FormValues): CalendarExceptionWrite {
  const scopeType = readText(values, 'scope_type') as ExceptionScope;
  const isFullDay = readBoolean(values, 'is_full_day', true);
  const payload: CalendarExceptionWrite = {
    semester: readRequiredId(values, 'semester'),
    date: readText(values, 'date'),
    exception_type: readText(values, 'exception_type') as ExceptionType,
    scope_type: scopeType,
    title: readText(values, 'title'),
    description: values.description ?? '',
    start_time: isFullDay ? null : readText(values, 'start_time'),
    end_time: isFullDay ? null : readText(values, 'end_time'),
    is_active: readBoolean(values, 'is_active', true),
  };

  if (scopeType === 'DEPARTMENT') {
    payload.department = readRequiredId(values, 'department');
  } else if (scopeType === 'INSTRUCTOR') {
    payload.instructor = readRequiredId(values, 'instructor');
  } else if (scopeType === 'ROOM') {
    payload.room = readRequiredId(values, 'room');
  } else if (scopeType === 'STUDENT_GROUP') {
    payload.student_group = readRequiredId(values, 'student_group');
  }

  return payload;
}

/** Scope value that a type forces, used to explain a locked control. */
export function exceptionScopeLockedReason(exceptionType: string): string | null {
  const required = requiredScopeFor(exceptionType as ExceptionType);
  return required === null
    ? null
    : `This exception type is always scoped to ${required.toLowerCase().replace('_', ' ')}.`;
}
