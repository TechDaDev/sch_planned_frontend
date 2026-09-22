/**
 * Instructor, room and calendar resource models.
 *
 * Field names mirror the accepted backend exactly (`resources/serializers.py`
 * and `scheduling/serializers.py`, Backend API v1.0.0). Read and write
 * representations are kept separate: writes submit foreign keys as ids, reads
 * answer with compact nested summaries.
 *
 * No hard delete exists on these endpoints, so no delete DTO or helper exists.
 */

import type {
  CourseOfferingSummary,
  DepartmentSummary,
  DecimalString,
  IsoDate,
  IsoDateTime,
  SemesterSummary,
  StudentGroupSummary,
  TeachingComponentSummary,
} from '@/lib/academic/types';

export type {
  CourseOfferingSummary,
  DepartmentSummary,
  DecimalString,
  IsoDate,
  IsoDateTime,
  SemesterSummary,
  StudentGroupSummary,
  TeachingComponentSummary,
};

/** `resources.models.SharingScope`. */
export type SharingScope = 'PRIVATE' | 'SELECTED_DEPARTMENTS' | 'COLLEGE_WIDE';

/** `resources.models.AssignmentRole`. */
export type AssignmentRole = 'PRIMARY' | 'ASSISTANT';

/** `resources.models.PreferenceType` — soft, never hard unavailability. */
export type PreferenceType = 'PREFERRED' | 'AVOID';

/** `scheduling.models.ExceptionType`. */
export type ExceptionType =
  | 'HOLIDAY'
  | 'EXAM'
  | 'EVENT'
  | 'MAINTENANCE'
  | 'INSTRUCTOR_ABSENCE'
  | 'ROOM_CLOSURE';

/** `scheduling.models.ExceptionScope`. */
export type ExceptionScope =
  | 'COLLEGE'
  | 'DEPARTMENT'
  | 'INSTRUCTOR'
  | 'ROOM'
  | 'STUDENT_GROUP';

/**
 * Shared `academics.models.Weekday` integers.
 *
 * Sunday is 0 and Thursday is 4: this is the college week order, not
 * JavaScript's `Date.getDay()` numbering, and it is the only weekday encoding
 * sent to the backend.
 */
export type Weekday = 0 | 1 | 2 | 3 | 4;

/** Wall-clock time as returned by the backend (`HH:MM:SS`). */
export type TimeString = string;

// --- Compact summaries ----------------------------------------------------

export interface InstructorAccountSummary {
  id: number;
  username: string;
}

export interface InstructorSummary {
  id: number;
  full_name: string;
  staff_code: string | null;
}

export interface RoomTypeSummary {
  id: number;
  name: string;
  code: string;
}

export interface RoomCapabilitySummary {
  id: number;
  name: string;
  code: string;
}

export interface RoomSummary {
  id: number;
  name: string;
  code: string;
}

/** `WorkingDaySummarySerializer`: the semester is a bare primary key here. */
export interface WorkingDaySummary {
  id: number;
  semester: number;
  day_of_week: Weekday;
  start_time: TimeString;
  end_time: TimeString;
}

export interface TeachingComponentRoomRequirementSummary {
  id: number;
  teaching_component: TeachingComponentSummary;
  minimum_capacity: number | null;
}

/** Target of a calendar exception; the shape depends on the scope. */
export type CalendarExceptionTarget =
  | DepartmentSummary
  | InstructorSummary
  | RoomSummary
  | StudentGroupSummary;

// --- Instructor resources -------------------------------------------------

export interface InstructorProfile {
  id: number;
  full_name: string;
  staff_code: string | null;
  academic_title: string;
  primary_department: DepartmentSummary;
  sharing_scope: SharingScope;
  max_weekly_hours: DecimalString | null;
  max_daily_hours: DecimalString | null;
  user: InstructorAccountSummary | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface InstructorProfileWrite {
  full_name: string;
  staff_code: string | null;
  academic_title: string;
  primary_department: number;
  sharing_scope: SharingScope;
  max_weekly_hours: DecimalString | null;
  max_daily_hours: DecimalString | null;
  /**
   * Optional account link. F2 never sends this: the backend exposes no
   * administrative endpoint for listing eligible accounts, so the field stays
   * absent and an existing link is preserved on unrelated updates.
   */
  user?: number | null;
  is_active: boolean;
}

export interface InstructorDepartmentAccess {
  id: number;
  instructor: InstructorSummary;
  department: DepartmentSummary;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface InstructorDepartmentAccessWrite {
  instructor: number;
  department: number;
  is_active: boolean;
}

export interface InstructorAvailability {
  id: number;
  instructor: InstructorSummary;
  semester: SemesterSummary;
  day_of_week: Weekday;
  day_of_week_display: string;
  start_time: TimeString;
  end_time: TimeString;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface InstructorAvailabilityWrite {
  instructor: number;
  semester: number;
  day_of_week: Weekday;
  start_time: TimeString;
  end_time: TimeString;
  is_active: boolean;
}

export interface InstructorPreference {
  id: number;
  instructor: InstructorSummary;
  semester: SemesterSummary;
  day_of_week: Weekday;
  day_of_week_display: string;
  start_time: TimeString;
  end_time: TimeString;
  preference_type: PreferenceType;
  preference_type_display: string;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface InstructorPreferenceWrite {
  instructor: number;
  semester: number;
  day_of_week: Weekday;
  start_time: TimeString;
  end_time: TimeString;
  preference_type: PreferenceType;
  is_active: boolean;
}

export interface TeachingAssignment {
  id: number;
  assignment_role: AssignmentRole;
  instructor: InstructorSummary;
  teaching_component: TeachingComponentSummary;
  offering: CourseOfferingSummary;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TeachingAssignmentWrite {
  teaching_component: number;
  instructor: number;
  assignment_role: AssignmentRole;
  is_active: boolean;
}

// --- Room resources -------------------------------------------------------

export interface RoomType {
  id: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface RoomTypeWrite {
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}

export interface RoomCapability {
  id: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface RoomCapabilityWrite {
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}

export interface Room {
  id: number;
  name: string;
  code: string;
  owner_department: DepartmentSummary;
  room_type: RoomTypeSummary;
  capacity: number;
  sharing_scope: SharingScope;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface RoomWrite {
  name: string;
  code: string;
  owner_department: number;
  room_type: number;
  capacity: number;
  sharing_scope: SharingScope;
  is_active: boolean;
}

export interface RoomDepartmentAccess {
  id: number;
  room: RoomSummary;
  department: DepartmentSummary;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface RoomDepartmentAccessWrite {
  room: number;
  department: number;
  is_active: boolean;
}

/** Relationship row without `is_active`: create/read/edit only. */
export interface RoomCapabilityAssignment {
  id: number;
  room: RoomSummary;
  capability: RoomCapabilitySummary;
  created_at: IsoDateTime;
}

export interface RoomCapabilityAssignmentWrite {
  room: number;
  capability: number;
}

export interface RoomAvailability {
  id: number;
  room: RoomSummary;
  semester: SemesterSummary;
  day_of_week: Weekday;
  day_of_week_display: string;
  start_time: TimeString;
  end_time: TimeString;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface RoomAvailabilityWrite {
  room: number;
  semester: number;
  day_of_week: Weekday;
  start_time: TimeString;
  end_time: TimeString;
  is_active: boolean;
}

export interface TeachingComponentRoomRequirement {
  id: number;
  teaching_component: TeachingComponentSummary;
  required_room_type: RoomTypeSummary | null;
  minimum_capacity: number | null;
  /** Derived by the backend from the attached student groups. */
  expected_student_count: number;
  /** Derived: `max(expected_student_count, minimum_capacity or 0)`. */
  effective_minimum_capacity: number;
  /** Derived list of required capabilities. */
  required_capabilities: RoomCapabilitySummary[];
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TeachingComponentRoomRequirementWrite {
  teaching_component: number;
  required_room_type: number | null;
  minimum_capacity: number | null;
  is_active: boolean;
}

/** Relationship row without `is_active`: create/read/edit only. */
export interface TeachingComponentCapabilityRequirement {
  id: number;
  room_requirement: TeachingComponentRoomRequirementSummary;
  capability: RoomCapabilitySummary;
  created_at: IsoDateTime;
}

export interface TeachingComponentCapabilityRequirementWrite {
  room_requirement: number;
  capability: number;
}

// --- Calendar configuration ----------------------------------------------

export interface WorkingDay {
  id: number;
  semester: SemesterSummary;
  day_of_week: Weekday;
  /** Enum name of the weekday, for example `SUNDAY`. */
  day_of_week_code: string | null;
  day_of_week_display: string;
  start_time: TimeString;
  end_time: TimeString;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface WorkingDayWrite {
  semester: number;
  day_of_week: Weekday;
  start_time: TimeString;
  end_time: TimeString;
  is_active: boolean;
}

export interface TimeSlot {
  id: number;
  working_day: WorkingDaySummary;
  sequence: number;
  label: string;
  start_time: TimeString;
  end_time: TimeString;
  /** Derived by the backend; never submitted. */
  duration_minutes: number | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TimeSlotWrite {
  working_day: number;
  sequence: number;
  label: string;
  start_time: TimeString;
  end_time: TimeString;
  is_active: boolean;
}

export interface BreakPeriod {
  id: number;
  working_day: WorkingDaySummary;
  name: string;
  start_time: TimeString;
  end_time: TimeString;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface BreakPeriodWrite {
  working_day: number;
  name: string;
  start_time: TimeString;
  end_time: TimeString;
  is_active: boolean;
}

export interface CalendarException {
  id: number;
  semester: SemesterSummary;
  date: IsoDate;
  exception_type: ExceptionType;
  exception_type_display: string;
  scope_type: ExceptionScope;
  scope_type_display: string;
  /** Single target matching the scope, `null` for `COLLEGE`. */
  target: CalendarExceptionTarget | null;
  title: string;
  description: string;
  start_time: TimeString | null;
  end_time: TimeString | null;
  /** Derived: true when no time window is set. */
  is_full_day: boolean;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface CalendarExceptionWrite {
  semester: number;
  date: IsoDate;
  exception_type: ExceptionType;
  scope_type: ExceptionScope;
  department?: number | null;
  instructor?: number | null;
  room?: number | null;
  student_group?: number | null;
  title: string;
  description: string;
  start_time: TimeString | null;
  end_time: TimeString | null;
  is_active: boolean;
}
