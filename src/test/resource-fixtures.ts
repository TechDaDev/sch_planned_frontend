/**
 * Test fixtures for the F2 resource module.
 *
 * Tests only: no application code imports this file, so no invented resource data
 * can reach the production UI.
 */

import type { AcademicCapabilityUser } from '@/lib/academic/permissions';
import type {
  BreakPeriod,
  CalendarException,
  InstructorAvailability,
  InstructorDepartmentAccess,
  InstructorPreference,
  InstructorProfile,
  Room,
  RoomAvailability,
  RoomCapability,
  RoomCapabilityAssignment,
  RoomDepartmentAccess,
  RoomType,
  TeachingAssignment,
  TeachingComponentCapabilityRequirement,
  TeachingComponentRoomRequirement,
  TimeSlot,
  WorkingDay,
} from '@/lib/resources/types';

const TIMESTAMP = '2026-09-01T08:00:00Z';

const DEPARTMENTS = {
  bioai: { id: 2, name: 'Biomedical AI', code: 'BIOAI' },
  cs: { id: 99, name: 'Computer Science', code: 'CS' },
} as const;

export function instructorRow(overrides: Partial<InstructorProfile> = {}): InstructorProfile {
  return {
    id: 1,
    full_name: 'Rana Salim',
    staff_code: 'I-1042',
    academic_title: 'Assistant Lecturer',
    primary_department: DEPARTMENTS.bioai,
    sharing_scope: 'PRIVATE',
    max_weekly_hours: '18.00',
    max_daily_hours: '5.00',
    user: null,
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function instructorAccessRow(
  overrides: Partial<InstructorDepartmentAccess> = {},
): InstructorDepartmentAccess {
  return {
    id: 2,
    instructor: { id: 1, full_name: 'Rana Salim', staff_code: 'I-1042' },
    department: DEPARTMENTS.cs,
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function instructorAvailabilityRow(
  overrides: Partial<InstructorAvailability> = {},
): InstructorAvailability {
  return {
    id: 3,
    instructor: { id: 1, full_name: 'Rana Salim', staff_code: 'I-1042' },
    semester: { id: 8, number: 1, academic_year: { id: 3, start_year: 2026, end_year: 2027 } },
    day_of_week: 0,
    day_of_week_display: 'Sunday',
    start_time: '08:00:00',
    end_time: '12:00:00',
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function instructorPreferenceRow(
  overrides: Partial<InstructorPreference> = {},
): InstructorPreference {
  return {
    id: 4,
    instructor: { id: 1, full_name: 'Rana Salim', staff_code: 'I-1042' },
    semester: { id: 8, number: 1, academic_year: { id: 3, start_year: 2026, end_year: 2027 } },
    day_of_week: 1,
    day_of_week_display: 'Monday',
    start_time: '08:00:00',
    end_time: '10:00:00',
    preference_type: 'AVOID',
    preference_type_display: 'Avoid',
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function teachingAssignmentRow(
  overrides: Partial<TeachingAssignment> = {},
): TeachingAssignment {
  return {
    id: 5,
    assignment_role: 'PRIMARY',
    instructor: { id: 1, full_name: 'Rana Salim', staff_code: 'I-1042' },
    teaching_component: { id: 10, component_type: 'THEORY', label: 'Lecture A' },
    offering: {
      id: 9,
      offering_code: 'MAIN',
      course: { id: 7, name: 'Machine Learning', code: 'ML301' },
    },
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function roomTypeRow(overrides: Partial<RoomType> = {}): RoomType {
  return {
    id: 20,
    name: 'Lecture hall',
    code: 'LECTURE_HALL',
    description: 'Tiered seating for lectures.',
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function roomCapabilityRow(
  overrides: Partial<RoomCapability> = {},
): RoomCapability {
  return {
    id: 21,
    name: 'Computers',
    code: 'COMPUTERS',
    description: 'Student workstations.',
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function roomRow(overrides: Partial<Room> = {}): Room {
  return {
    id: 22,
    name: 'Artificial Intelligence Lab',
    code: 'AI-LAB-1',
    owner_department: DEPARTMENTS.bioai,
    room_type: { id: 20, name: 'Lecture hall', code: 'LECTURE_HALL' },
    capacity: 30,
    sharing_scope: 'PRIVATE',
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function roomAccessRow(
  overrides: Partial<RoomDepartmentAccess> = {},
): RoomDepartmentAccess {
  return {
    id: 23,
    room: { id: 22, name: 'Artificial Intelligence Lab', code: 'AI-LAB-1' },
    department: DEPARTMENTS.cs,
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function roomCapabilityAssignmentRow(
  overrides: Partial<RoomCapabilityAssignment> = {},
): RoomCapabilityAssignment {
  return {
    id: 24,
    room: { id: 22, name: 'Artificial Intelligence Lab', code: 'AI-LAB-1' },
    capability: { id: 21, name: 'Computers', code: 'COMPUTERS' },
    created_at: TIMESTAMP,
    ...overrides,
  };
}

export function roomAvailabilityRow(
  overrides: Partial<RoomAvailability> = {},
): RoomAvailability {
  return {
    id: 25,
    room: { id: 22, name: 'Artificial Intelligence Lab', code: 'AI-LAB-1' },
    semester: { id: 8, number: 1, academic_year: { id: 3, start_year: 2026, end_year: 2027 } },
    day_of_week: 0,
    day_of_week_display: 'Sunday',
    start_time: '08:00:00',
    end_time: '16:00:00',
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function roomRequirementRow(
  overrides: Partial<TeachingComponentRoomRequirement> = {},
): TeachingComponentRoomRequirement {
  return {
    id: 26,
    teaching_component: { id: 10, component_type: 'THEORY', label: 'Lecture A' },
    required_room_type: { id: 20, name: 'Lecture hall', code: 'LECTURE_HALL' },
    minimum_capacity: 40,
    expected_student_count: 35,
    effective_minimum_capacity: 40,
    required_capabilities: [{ id: 21, name: 'Computers', code: 'COMPUTERS' }],
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function capabilityRequirementRow(
  overrides: Partial<TeachingComponentCapabilityRequirement> = {},
): TeachingComponentCapabilityRequirement {
  return {
    id: 27,
    room_requirement: {
      id: 26,
      teaching_component: { id: 10, component_type: 'THEORY', label: 'Lecture A' },
      minimum_capacity: 40,
    },
    capability: { id: 21, name: 'Computers', code: 'COMPUTERS' },
    created_at: TIMESTAMP,
    ...overrides,
  };
}

export function workingDayRow(overrides: Partial<WorkingDay> = {}): WorkingDay {
  return {
    id: 30,
    semester: { id: 8, number: 1, academic_year: { id: 3, start_year: 2026, end_year: 2027 } },
    day_of_week: 0,
    day_of_week_code: 'SUNDAY',
    day_of_week_display: 'Sunday',
    start_time: '08:00:00',
    end_time: '16:00:00',
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function timeSlotRow(overrides: Partial<TimeSlot> = {}): TimeSlot {
  return {
    id: 31,
    working_day: { id: 30, semester: 8, day_of_week: 0, start_time: '08:00:00', end_time: '16:00:00' },
    sequence: 1,
    label: 'Period 1',
    start_time: '08:00:00',
    end_time: '09:30:00',
    duration_minutes: 90,
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function breakPeriodRow(overrides: Partial<BreakPeriod> = {}): BreakPeriod {
  return {
    id: 32,
    working_day: { id: 30, semester: 8, day_of_week: 0, start_time: '08:00:00', end_time: '16:00:00' },
    name: 'Lunch break',
    start_time: '12:00:00',
    end_time: '13:00:00',
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

export function calendarExceptionRow(
  overrides: Partial<CalendarException> = {},
): CalendarException {
  return {
    id: 40,
    semester: { id: 8, number: 1, academic_year: { id: 3, start_year: 2026, end_year: 2027 } },
    date: '2026-10-01',
    exception_type: 'HOLIDAY',
    exception_type_display: 'Holiday',
    scope_type: 'COLLEGE',
    scope_type_display: 'College-wide',
    target: null,
    title: 'Founding day',
    description: '',
    start_time: null,
    end_time: null,
    is_full_day: true,
    is_active: true,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

// --- Capability users -----------------------------------------------------

export function resourceUser(
  overrides: Partial<AcademicCapabilityUser> = {},
): AcademicCapabilityUser {
  return { role: 'COLLEGE_ADMIN', department: null, ...overrides };
}

export const resourceCollegeAdmin = resourceUser({
  role: 'COLLEGE_ADMIN',
  department: null,
});

export const resourceDepartmentAdmin = resourceUser({
  role: 'DEPARTMENT_ADMIN',
  department: { id: 2 },
});

export const resourceOtherDepartmentAdmin = resourceUser({
  role: 'DEPARTMENT_ADMIN',
  department: { id: 99 },
});

export const resourceUnassignedDepartmentAdmin = resourceUser({
  role: 'DEPARTMENT_ADMIN',
  department: null,
});

export const resourceScheduler = resourceUser({
  role: 'SCHEDULER',
  department: { id: 2 },
});

export const resourceViewer = resourceUser({
  role: 'VIEWER',
  department: { id: 2 },
});

export const resourceInstructorUser = resourceUser({
  role: 'INSTRUCTOR',
  department: { id: 2 },
});

export const BIOAI_DEPARTMENT_ID = DEPARTMENTS.bioai.id;
export const CS_DEPARTMENT_ID = DEPARTMENTS.cs.id;
