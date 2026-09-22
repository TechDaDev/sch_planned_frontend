/**
 * Presentation helpers for resources and calendar configuration.
 *
 * Formatting is deterministic and locale-independent: no `toLocaleString` runs
 * on values that differ between server and client, and no timezone conversion is
 * ever applied to recurring wall-clock times or date-only values.
 */

import { formatSemester, formatComponentType } from '@/lib/academic/formatters';
import type { DepartmentSummary, SemesterSummary } from '@/lib/academic/types';
import {
  ASSIGNMENT_ROLE_LABELS,
  EXCEPTION_SCOPE_LABELS,
  EXCEPTION_TYPE_LABELS,
  PREFERENCE_TYPE_LABELS,
  SHARING_SCOPE_LABELS,
  WEEKDAY_LABELS,
} from '@/lib/resources/constants';
import type {
  AssignmentRole,
  CalendarExceptionTarget,
  ExceptionScope,
  ExceptionType,
  InstructorSummary,
  PreferenceType,
  RoomSummary,
  SharingScope,
  Weekday,
  WorkingDay,
} from '@/lib/resources/types';
import { toTimeInputValue } from '@/lib/resources/validation';

export { formatSemester, formatComponentType };

/** Weekday label for the shared college week (Sunday = 0). */
export function formatWeekday(value: Weekday | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return WEEKDAY_LABELS[value as Weekday] ?? `Day ${value}`;
}

/** `08:30` from `08:30:00`, without any timezone shift. */
export function formatTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  return toTimeInputValue(value) || '—';
}

export function formatTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string {
  if (!startTime && !endTime) {
    return '—';
  }
  return `${formatTime(startTime)}–${formatTime(endTime)}`;
}

export function formatSharingScope(value: SharingScope): string {
  return SHARING_SCOPE_LABELS[value] ?? value;
}

export function formatAssignmentRole(value: AssignmentRole): string {
  return ASSIGNMENT_ROLE_LABELS[value] ?? value;
}

export function formatPreferenceType(value: PreferenceType): string {
  return PREFERENCE_TYPE_LABELS[value] ?? value;
}

export function formatExceptionType(value: ExceptionType): string {
  return EXCEPTION_TYPE_LABELS[value] ?? value;
}

export function formatExceptionScope(value: ExceptionScope): string {
  return EXCEPTION_SCOPE_LABELS[value] ?? value;
}

/** `Rana Salim (I-1042)` — staff code is optional. */
export function formatInstructor(instructor: InstructorSummary): string {
  return instructor.staff_code
    ? `${instructor.full_name} (${instructor.staff_code})`
    : instructor.full_name;
}

export function formatDepartment(department: DepartmentSummary | null): string {
  return department ? `${department.code} — ${department.name}` : '—';
}

/** `AI-LAB-1 — Artificial Intelligence Lab`. */
export function formatRoom(room: RoomSummary): string {
  return `${room.code} — ${room.name}`;
}

/** `2026–2027 · First semester`. */
export function formatSemesterShort(semester: SemesterSummary): string {
  return formatSemester(semester);
}

/**
 * Working day context for a row whose `working_day` is a bare summary:
 * `2026–2027 · First semester — Sunday 08:00–16:00`.
 */
export function formatWorkingDayContext(
  workingDay: WorkingDay | null | undefined,
  semester?: SemesterSummary | null,
  weekdayLabel?: string | null,
  timeRange?: string | null,
): string {
  if (workingDay) {
    const dayLabel = workingDay.day_of_week_display || formatWeekday(workingDay.day_of_week);
    return `${formatSemester(workingDay.semester)} — ${dayLabel} ${formatTimeRange(
      workingDay.start_time,
      workingDay.end_time,
    )}`;
  }
  const parts = [
    semester ? formatSemester(semester) : null,
    weekdayLabel ?? null,
    timeRange ?? null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(' — ');
}

/** Short context of a room requirement: `CS301 — Theory (Lecture A)`. */
export function formatComponentContext(component: {
  component_type: 'THEORY' | 'PRACTICAL';
  label: string;
  offering?: { offering_code: string; course: { code: string; name: string } } | null;
}): string {
  const type = formatComponentType(component.component_type);
  const label = component.label ? ` (${component.label})` : '';
  const offering = component.offering
    ? `${component.offering.course.code} — ${component.offering.offering_code} — `
    : '';
  return `${offering}${type}${label}`;
}

/** Target of a calendar exception, whatever its scope shape. */
export function formatExceptionTarget(
  target: CalendarExceptionTarget | null | undefined,
): string {
  if (!target) {
    return '—';
  }
  // The four summary shapes differ (instructors have `full_name`, the rest have
  // `name` + `code`), so the value is read structurally instead of by union
  // narrowing.
  const summary = target as {
    id: number;
    full_name?: string;
    staff_code?: string | null;
    name?: string;
    code?: string;
  };
  if (summary.full_name) {
    return summary.staff_code
      ? `${summary.full_name} (${summary.staff_code})`
      : summary.full_name;
  }
  if (summary.code && summary.name) {
    return `${summary.code} — ${summary.name}`;
  }
  return summary.name ?? `#${summary.id}`;
}

export function formatFullDay(value: boolean): string {
  return value ? 'Full day' : 'Partial day';
}

export function formatMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value} min`;
}

export function formatCapacity(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return String(value);
}
