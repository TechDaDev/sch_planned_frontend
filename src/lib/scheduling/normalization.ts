/**
 * Normalization of preview placements and persisted entries into one timetable
 * domain.
 *
 * A preview placement and a stored entry describe the same thing - one physical
 * weekly session - but they are produced by different serializers. Normalizing
 * both into `TimetableSession` lets a single visualization render either, while
 * `source` keeps the distinction visible so a preview is never labelled as a
 * stored version.
 *
 * Two rules are load-bearing:
 * - a session occupying several periods stays **one** event; the periods live in
 *   `slots` and `startTime`/`endTime` span the whole block;
 * - a joint session serving several student groups stays **one** session, listing
 *   every group instead of being duplicated per group or per department.
 *
 * Every descriptive value is taken from the payload as received. Persisted
 * entries are snapshots, so no live academic or resource collection is ever
 * consulted here.
 */

import type { DepartmentSummary } from '@/lib/academic/types';
import type {
  CollegeGenerationPlacement,
  GenerationPlacement,
  ScheduleEntry,
  TimetableGroup,
  TimetableInstructor,
  TimetableSession,
  TimetableSlot,
} from '@/lib/scheduling/types';

/** `08:30` from `08:30:00` without any timezone shift. */
export function toClockTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) {
    return value;
  }
  const hours = (match[1] ?? '0').padStart(2, '0');
  return `${hours}:${match[2]}`;
}

/** Minutes since midnight, for positioning and ordering. */
export function toMinutes(value: string | null | undefined): number | null {
  const clock = toClockTime(value);
  const match = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Duration in minutes between two wall-clock times, or `null` when unknown. */
export function durationMinutes(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (from === null || to === null || to < from) {
    return null;
  }
  return to - from;
}

function normalizeInstructors(
  instructors: readonly {
    id: number;
    full_name: string;
    assignment_role?: string | null;
  }[],
): TimetableInstructor[] {
  return instructors.map((instructor) => ({
    id: instructor.id,
    fullName: instructor.full_name,
    assignmentRole: instructor.assignment_role ?? null,
  }));
}

function normalizeGroups(
  groups: readonly {
    id: number;
    code: string;
    name: string;
    department?: DepartmentSummary | null;
  }[],
): TimetableGroup[] {
  return groups.map((group) => ({
    id: group.id,
    code: group.code,
    name: group.name,
    department: group.department ?? null,
  }));
}

function slotFromPreview(slot: GenerationPlacement['slots'][number], index: number): TimetableSlot {
  return {
    key: `slot-${index}-${slot.id}`,
    sequence: slot.sequence,
    label: slot.label ?? '',
    startTime: toClockTime(slot.start_time),
    endTime: toClockTime(slot.end_time),
  };
}

function slotFromEntry(slot: ScheduleEntry['time_slots'][number], index: number): TimetableSlot {
  return {
    key: `slot-${index}-${slot.position}-${slot.id}`,
    sequence: slot.sequence,
    label: slot.label ?? '',
    startTime: toClockTime(slot.start_time),
    endTime: toClockTime(slot.end_time),
  };
}

/** Normalize one preview placement. */
export function sessionFromPlacement(
  placement: GenerationPlacement | CollegeGenerationPlacement,
  fallbackManagingDepartment: DepartmentSummary | null = null,
): TimetableSession {
  const managingDepartment =
    'managing_department' in placement && placement.managing_department
      ? placement.managing_department
      : fallbackManagingDepartment;

  return {
    sessionId: placement.session_id,
    course: placement.course,
    offering: placement.offering,
    teachingComponent: placement.teaching_component,
    managingDepartment,
    dayOfWeek: placement.day_of_week,
    dayDisplay: placement.day_display,
    startTime: toClockTime(placement.start_time),
    endTime: toClockTime(placement.end_time),
    slots: placement.slots.map(slotFromPreview),
    room: placement.room ?? null,
    instructors: normalizeInstructors(placement.instructors),
    studentGroups: normalizeGroups(placement.student_groups),
    penalty: placement.penalty,
    source: 'PREVIEW',
  };
}

/** Normalize one persisted entry, keeping its snapshot values untouched. */
export function sessionFromEntry(entry: ScheduleEntry): TimetableSession {
  return {
    sessionId: entry.session_id,
    course: entry.course,
    offering: entry.offering,
    teachingComponent: entry.teaching_component,
    managingDepartment: entry.managing_department ?? null,
    dayOfWeek: entry.day_of_week,
    dayDisplay: entry.day_display,
    startTime: toClockTime(entry.start_time),
    endTime: toClockTime(entry.end_time),
    slots: entry.time_slots.map(slotFromEntry),
    room: entry.room ?? null,
    instructors: normalizeInstructors(entry.instructors),
    studentGroups: normalizeGroups(entry.student_groups),
    penalty: entry.penalty,
    source: 'PERSISTED',
    entryId: entry.id,
    candidateId: entry.candidate_id,
    sessionOrdinal: entry.session_ordinal,
  };
}

/** Normalize a whole preview payload. */
export function sessionsFromPlacements(
  placements: readonly (GenerationPlacement | CollegeGenerationPlacement)[] | undefined,
  fallbackManagingDepartment: DepartmentSummary | null = null,
): TimetableSession[] {
  return (placements ?? []).map((placement) =>
    sessionFromPlacement(placement, fallbackManagingDepartment),
  );
}

/** Normalize a whole persisted-entry payload. */
export function sessionsFromEntries(
  entries: readonly ScheduleEntry[] | undefined,
): TimetableSession[] {
  return (entries ?? []).map(sessionFromEntry);
}

/**
 * Order sessions the way the college week reads: weekday, then first period,
 * then course code and session id so the order is stable across renders.
 */
export function sortSessions(sessions: readonly TimetableSession[]): TimetableSession[] {
  return [...sessions].sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) {
      return left.dayOfWeek - right.dayOfWeek;
    }
    const leftStart = toMinutes(left.startTime) ?? 0;
    const rightStart = toMinutes(right.startTime) ?? 0;
    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }
    const byCourse = left.course.code.localeCompare(right.course.code);
    if (byCourse !== 0) {
      return byCourse;
    }
    return left.sessionId.localeCompare(right.sessionId);
  });
}

// --- Presentation filters (client-side only) ------------------------------

/** Filter selections, all keyed by the ids the timetable payload carries. */
export interface TimetableFilter {
  departmentId?: number | null;
  courseId?: number | null;
  instructorId?: number | null;
  studentGroupId?: number | null;
  roomId?: number | null;
  dayOfWeek?: number | null;
}

/**
 * Apply presentation filters.
 *
 * Filtering changes what is displayed and nothing else: the preview endpoints
 * accept no filters at all, and a persisted version is immutable, so no filter
 * ever becomes a query parameter or a mutation.
 */
export function filterSessions(
  sessions: readonly TimetableSession[],
  filter: TimetableFilter,
): TimetableSession[] {
  return sessions.filter((session) => {
    if (
      filter.departmentId != null &&
      session.managingDepartment?.id !== filter.departmentId
    ) {
      return false;
    }
    if (filter.courseId != null && session.course.id !== filter.courseId) {
      return false;
    }
    if (
      filter.instructorId != null &&
      !session.instructors.some((instructor) => instructor.id === filter.instructorId)
    ) {
      return false;
    }
    if (
      filter.studentGroupId != null &&
      !session.studentGroups.some((group) => group.id === filter.studentGroupId)
    ) {
      return false;
    }
    if (filter.roomId != null && session.room?.id !== filter.roomId) {
      return false;
    }
    if (filter.dayOfWeek != null && session.dayOfWeek !== filter.dayOfWeek) {
      return false;
    }
    return true;
  });
}

/** Distinct filter choices present in a timetable, so no empty option is offered. */
export interface TimetableFilterOptions {
  departments: { id: number; label: string }[];
  courses: { id: number; label: string }[];
  instructors: { id: number; label: string }[];
  studentGroups: { id: number; label: string }[];
  rooms: { id: number; label: string }[];
  weekdays: { value: number; label: string }[];
}

function pushUnique(
  target: { id: number; label: string }[],
  seen: Set<number>,
  id: number,
  label: string,
): void {
  if (seen.has(id)) {
    return;
  }
  seen.add(id);
  target.push({ id, label });
}

export function collectFilterOptions(
  sessions: readonly TimetableSession[],
  weekdayLabel: (value: number) => string,
): TimetableFilterOptions {
  const departments: { id: number; label: string }[] = [];
  const courses: { id: number; label: string }[] = [];
  const instructors: { id: number; label: string }[] = [];
  const studentGroups: { id: number; label: string }[] = [];
  const rooms: { id: number; label: string }[] = [];
  const weekdays: { value: number; label: string }[] = [];

  const departmentIds = new Set<number>();
  const courseIds = new Set<number>();
  const instructorIds = new Set<number>();
  const groupIds = new Set<number>();
  const roomIds = new Set<number>();
  const weekdayValues = new Set<number>();

  for (const session of sessions) {
    if (session.managingDepartment) {
      pushUnique(
        departments,
        departmentIds,
        session.managingDepartment.id,
        `${session.managingDepartment.code} — ${session.managingDepartment.name}`,
      );
    }
    pushUnique(
      courses,
      courseIds,
      session.course.id,
      `${session.course.code} — ${session.course.name}`,
    );
    for (const instructor of session.instructors) {
      pushUnique(instructors, instructorIds, instructor.id, instructor.fullName);
    }
    for (const group of session.studentGroups) {
      pushUnique(studentGroups, groupIds, group.id, `${group.code} — ${group.name}`);
    }
    if (session.room) {
      pushUnique(rooms, roomIds, session.room.id, `${session.room.code} — ${session.room.name}`);
    }
    if (!weekdayValues.has(session.dayOfWeek)) {
      weekdayValues.add(session.dayOfWeek);
      weekdays.push({ value: session.dayOfWeek, label: weekdayLabel(session.dayOfWeek) });
    }
  }

  const byLabel = (
    left: { id: number; label: string },
    right: { id: number; label: string },
  ) => left.label.localeCompare(right.label);

  return {
    departments: departments.sort(byLabel),
    courses: courses.sort(byLabel),
    instructors: instructors.sort(byLabel),
    studentGroups: studentGroups.sort(byLabel),
    rooms: rooms.sort(byLabel),
    weekdays: weekdays.sort((left, right) => left.value - right.value),
  };
}
