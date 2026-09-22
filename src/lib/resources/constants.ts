/**
 * Resource constants: exact backend enum values, display labels and routes.
 *
 * Values are never translated before being sent to the backend; labels exist for
 * presentation only.
 */

import type { Option } from '@/lib/academic/constants';
import type {
  AssignmentRole,
  ExceptionScope,
  ExceptionType,
  PreferenceType,
  SharingScope,
  Weekday,
} from '@/lib/resources/types';

// --- Sharing --------------------------------------------------------------

export const SHARING_SCOPE_OPTIONS: readonly Option<SharingScope>[] = [
  { value: 'PRIVATE', label: 'Private' },
  { value: 'SELECTED_DEPARTMENTS', label: 'Selected departments' },
  { value: 'COLLEGE_WIDE', label: 'College-wide' },
];

export const SHARING_SCOPE_LABELS: Record<SharingScope, string> = {
  PRIVATE: 'Private',
  SELECTED_DEPARTMENTS: 'Selected departments',
  COLLEGE_WIDE: 'College-wide',
};

/** Copy that keeps the three scopes' meaning visible in the UI. */
export const SHARING_SCOPE_HELP: Record<SharingScope, string> = {
  PRIVATE:
    'Only the owning department may schedule this resource. Existing sharing grants stay on file but are not effective.',
  SELECTED_DEPARTMENTS:
    'Departments with an active sharing grant may schedule this resource.',
  COLLEGE_WIDE: 'Every active department may schedule this resource.',
};

// --- Assignments ----------------------------------------------------------

export const ASSIGNMENT_ROLE_OPTIONS: readonly Option<AssignmentRole>[] = [
  { value: 'PRIMARY', label: 'Primary' },
  { value: 'ASSISTANT', label: 'Assistant' },
];

export const ASSIGNMENT_ROLE_LABELS: Record<AssignmentRole, string> = {
  PRIMARY: 'Primary',
  ASSISTANT: 'Assistant',
};

/** A component may hold at most one active primary instructor. */
export const SINGLE_PRIMARY_HINT =
  'A teaching component can have only one active primary instructor.';

// --- Preferences ----------------------------------------------------------

export const PREFERENCE_TYPE_OPTIONS: readonly Option<PreferenceType>[] = [
  { value: 'PREFERRED', label: 'Preferred' },
  { value: 'AVOID', label: 'Avoid' },
];

export const PREFERENCE_TYPE_LABELS: Record<PreferenceType, string> = {
  PREFERRED: 'Preferred',
  AVOID: 'Avoid',
};

/** Distinguishes a soft preference from the hard availability table. */
export const PREFERENCE_SOFT_NOTICE =
  'Preferences are soft: “Avoid” expresses a scheduling preference and is not an unavailable period.';

export const AVAILABILITY_HARD_NOTICE =
  'Availability windows are hard constraints. No row for a weekday means availability is not configured — it never means the instructor is free all day.';

// --- Weekdays -------------------------------------------------------------

export const WEEKDAY_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
};

// --- Calendar exceptions --------------------------------------------------

export const EXCEPTION_TYPE_OPTIONS: readonly Option<ExceptionType>[] = [
  { value: 'HOLIDAY', label: 'Holiday' },
  { value: 'EXAM', label: 'Examination' },
  { value: 'EVENT', label: 'Event' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'INSTRUCTOR_ABSENCE', label: 'Instructor absence' },
  { value: 'ROOM_CLOSURE', label: 'Room closure' },
];

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  HOLIDAY: 'Holiday',
  EXAM: 'Examination',
  EVENT: 'Event',
  MAINTENANCE: 'Maintenance',
  INSTRUCTOR_ABSENCE: 'Instructor absence',
  ROOM_CLOSURE: 'Room closure',
};

export const EXCEPTION_SCOPE_OPTIONS: readonly Option<ExceptionScope>[] = [
  { value: 'COLLEGE', label: 'College-wide' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'INSTRUCTOR', label: 'Instructor' },
  { value: 'ROOM', label: 'Room' },
  { value: 'STUDENT_GROUP', label: 'Student group' },
];

export const EXCEPTION_SCOPE_LABELS: Record<ExceptionScope, string> = {
  COLLEGE: 'College-wide',
  DEPARTMENT: 'Department',
  INSTRUCTOR: 'Instructor',
  ROOM: 'Room',
  STUDENT_GROUP: 'Student group',
};

/** Types pinned to exactly one scope by the backend model. */
export const EXCEPTION_TYPE_REQUIRED_SCOPE: Partial<Record<ExceptionType, ExceptionScope>> = {
  INSTRUCTOR_ABSENCE: 'INSTRUCTOR',
  ROOM_CLOSURE: 'ROOM',
};

export const COLLEGE_WIDE_EXCEPTION_NOTICE =
  'Only college administrators may manage college-wide exceptions.';

// --- Routes ---------------------------------------------------------------

export const RESOURCE_ROUTES = {
  overview: '/resources',
  instructors: '/resources/instructors',
  instructorSharing: '/resources/instructor-sharing',
  instructorAvailability: '/resources/instructor-availability',
  instructorPreferences: '/resources/instructor-preferences',
  teachingAssignments: '/resources/teaching-assignments',
  roomTypes: '/resources/room-types',
  roomCapabilities: '/resources/room-capabilities',
  rooms: '/resources/rooms',
  roomSharing: '/resources/room-sharing',
  roomCapabilityAssignments: '/resources/room-capability-assignments',
  roomAvailability: '/resources/room-availability',
  roomRequirements: '/resources/room-requirements',
  roomRequirementCapabilities: '/resources/room-requirement-capabilities',
  calendar: '/resources/calendar',
  workingDays: '/resources/calendar/working-days',
  timeSlots: '/resources/calendar/time-slots',
  breakPeriods: '/resources/calendar/breaks',
  calendarExceptions: '/resources/calendar/exceptions',
} as const;

/** Roles that may open the Resources module at all. */
export const RESOURCE_MODULE_ROLES = ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SCHEDULER'] as const;

/** Roles allowed to change resource data (a scheduler is read-only). */
export const RESOURCE_MANAGER_ROLES = ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'] as const;

export const DEACTIVATION_NOTICE =
  'This does not delete the record. It marks it inactive.';

export const SCHEDULER_READ_ONLY_NOTICE =
  'Read-only access: the Scheduler role prepares schedules from this data but does not change it.';

export const ACCOUNT_LINKING_NOTICE =
  'Login account linking is not available through the current administration API.';

export const ROOM_REQUIREMENT_DERIVED_NOTICE =
  'Expected student count and effective minimum capacity are derived by the server and cannot be edited.';
