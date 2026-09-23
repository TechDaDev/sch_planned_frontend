/**
 * Presentation helpers for the scheduling workspace.
 *
 * Formatting is deterministic and locale-independent: no `toLocaleString` runs
 * on values that differ between server and client, and recurring wall-clock
 * times are never shifted by a timezone.
 */

import type { DepartmentSummary, SemesterSummary } from '@/lib/academic/types';
import { formatSemester } from '@/lib/academic/formatters';
import {
  GENERATION_REJECTION_HELP,
  GENERATION_REJECTION_LABELS,
  SCHEDULE_SCOPE_LABELS,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_VERSION_SOURCE_LABELS,
  SCHEDULE_STATUS_TONES,
  SEVERITY_LABELS,
  SOLVER_STATUS_HELP,
  SOLVER_STATUS_LABELS,
  WEEKDAY_LABELS,
} from '@/lib/scheduling/constants';
import { toClockTime, durationMinutes } from '@/lib/scheduling/normalization';
import type {
  GenerationRejectionReason,
  ScheduleScope,
  ScheduleStatus,
  ScheduleVersionSource,
  Severity,
  TimetableSession,
  ValidationSemester,
} from '@/lib/scheduling/types';

export { formatSemester };
export { toClockTime };

/** `Sunday` for the shared college week (Sunday = 0). */
export function formatDay(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return WEEKDAY_LABELS[value] ?? `Day ${value}`;
}

/** `08:30–10:00`, without any timezone shift. */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const from = toClockTime(start);
  const to = toClockTime(end);
  if (!from && !to) {
    return '—';
  }
  return `${from || '—'}–${to || '—'}`;
}

/** Duration of a session, read from its own start and end times. */
export function formatDuration(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const minutes = durationMinutes(start, end);
  return minutes === null ? '—' : `${minutes} min`;
}

/**
 * Semester identity of a scheduling response.
 *
 * `academic_year` is already the human label (`"2026-2027"`), so the id is never
 * shown as the primary label.
 */
export function formatValidationSemester(semester: ValidationSemester): string {
  return `${semester.academic_year} · Semester ${semester.number}`;
}

/** `Computer Science (CS)` — used wherever a department is named. */
export function formatDepartment(
  department: DepartmentSummary | null | undefined,
): string {
  if (!department) {
    return 'College-wide';
  }
  return `${department.name} (${department.code})`;
}

export function formatDepartmentCode(
  department: DepartmentSummary | null | undefined,
): string {
  return department ? department.code : 'College-wide';
}

export function formatScope(scope: ScheduleScope): string {
  return SCHEDULE_SCOPE_LABELS[scope] ?? scope;
}

export function formatScheduleStatus(status: ScheduleStatus | null | undefined): string {
  if (!status) {
    return 'No versions';
  }
  return SCHEDULE_STATUS_LABELS[status] ?? status;
}

export function scheduleStatusTone(
  status: ScheduleStatus | null | undefined,
): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (!status) {
    return 'neutral';
  }
  return SCHEDULE_STATUS_TONES[status] ?? 'neutral';
}

export function formatVersionSource(source: ScheduleVersionSource): string {
  return SCHEDULE_VERSION_SOURCE_LABELS[source] ?? source;
}

export function formatSeverity(severity: Severity): string {
  return SEVERITY_LABELS[severity] ?? severity;
}

/**
 * Turn a stored summary key into the label a reader sees.
 *
 * A persisted summary arrives as a payload whose keys are machine names such as
 * `components_checked` or `min_candidates_per_session`. They are shown as
 * sentences instead of as keys, without renaming the data underneath.
 */
export function formatSummaryLabel(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  if (words.length === 0) {
    return key;
  }
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatSolverStatus(status: string | null | undefined): string {
  if (!status) {
    return 'No solver result';
  }
  // A persisted version stores the status as free text, so an unknown value is
  // shown verbatim rather than being hidden.
  return (SOLVER_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

/** One-line explanation of a solver status; never claims more than it proves. */
export function describeSolverStatus(status: string | null | undefined): string {
  if (!status) {
    return 'This run produced no solver result.';
  }
  return (SOLVER_STATUS_HELP as Record<string, string>)[status] ?? '';
}

export function formatRejectionReason(reason: GenerationRejectionReason): string {
  return GENERATION_REJECTION_LABELS[reason] ?? reason;
}

export function describeRejectionReason(reason: GenerationRejectionReason): string {
  return GENERATION_REJECTION_HELP[reason] ?? '';
}

/** `ML301 — Machine Learning`. */
export function formatCourse(course: { code: string; name: string }): string {
  return `${course.code} — ${course.name}`;
}

/** `Theory (Lecture A)` / `Theory`. */
export function formatComponent(component: {
  component_type: string;
  label?: string;
}): string {
  return component.label
    ? `${component.component_type} (${component.label})`
    : component.component_type;
}

/** `AI-LAB-1 — Artificial Intelligence Lab`, or a stated absence. */
export function formatRoom(room: { code: string; name: string } | null | undefined): string {
  return room ? `${room.code} — ${room.name}` : 'No room assigned';
}

export function formatInstructorList(
  instructors: readonly { fullName: string; assignmentRole: string | null }[],
): string {
  if (instructors.length === 0) {
    return 'No instructor assigned';
  }
  return instructors
    .map((instructor) =>
      instructor.assignmentRole
        ? `${instructor.fullName} (${instructor.assignmentRole})`
        : instructor.fullName,
    )
    .join(', ');
}

export function formatGroupList(
  groups: readonly { code: string; name: string }[],
): string {
  if (groups.length === 0) {
    return 'No student group';
  }
  return groups.map((group) => `${group.code} — ${group.name}`).join(', ');
}

/** `Sunday 08:30–10:00` — the accessible one-line identity of a session. */
export function formatSessionWhen(session: TimetableSession): string {
  return `${session.dayDisplay || formatDay(session.dayOfWeek)} ${formatTimeRange(
    session.startTime,
    session.endTime,
  )}`;
}

/** Number formatting that never depends on the host locale. */
export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : String(value);
}

export function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value.toFixed(1)} s`;
}

/** True when both sides name the same semester record. */
export function sameSemester(
  left: SemesterSummary | null | undefined,
  right: SemesterSummary | null | undefined,
): boolean {
  return Boolean(left && right && left.id === right.id);
}
