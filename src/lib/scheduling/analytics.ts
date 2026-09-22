/**
 * Report helpers.
 *
 * Analytics arrive fully computed, and every descriptive label comes from the
 * response's own snapshot references. Nothing here joins current academic or resource
 * data over them, and nothing derives a composite score: the backend computes none,
 * and inventing one would be a fabricated metric.
 */

import type {
  AnalyticsRoomUsage,
  AnalyticsSnapshotRef,
  AnalyticsStudentGroupLoad,
  AnalyticsInstructorWorkload,
  AnalyticsDepartmentLoad,
  ScheduleAnalyticsResult,
} from '@/lib/scheduling/types';

/** `CODE — Name`, or a stated absence. */
export function formatReference(reference: AnalyticsSnapshotRef | null | undefined): string {
  if (!reference) {
    return '—';
  }
  const code = reference.code ?? '';
  const name = reference.name ?? '';
  if (code && name) {
    return `${code} — ${name}`;
  }
  return name || code || (reference.id != null ? `#${reference.id}` : '—');
}

/** Hours with one decimal, from the integer minutes the backend sends. */
export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value.toFixed(1)} h`;
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : String(value);
}

export function formatDecimal(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? '—' : value.toFixed(digits);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value.toFixed(1)}%`;
}

/**
 * Room utilization display.
 *
 * A missing denominator is stated in words rather than shown as `0%`, and a
 * percentage above 100 is never clamped.
 */
export interface RoomUtilizationView {
  availabilityLabel: string;
  utilizationLabel: string;
  mismatch: boolean;
}

export function roomUtilizationView(room: AnalyticsRoomUsage): RoomUtilizationView {
  const hasDenominator =
    room.available_minutes !== null &&
    room.available_minutes !== undefined &&
    room.utilization_percent !== null &&
    room.utilization_percent !== undefined;

  return {
    availabilityLabel: hasDenominator
      ? `${formatHours(room.available_hours ?? null)} across the current grid`
      : 'Current availability denominator unavailable',
    utilizationLabel: hasDenominator ? formatPercent(room.utilization_percent) : '—',
    mismatch: room.configuration_mismatch === true,
  };
}

/** Room rows whose percentage exceeds 100 are flagged, never rewritten. */
export function roomUtilizationExceedsAvailability(room: AnalyticsRoomUsage): boolean {
  return (
    room.utilization_percent !== null &&
    room.utilization_percent !== undefined &&
    room.utilization_percent > 100
  );
}

function byReferenceLabel(
  left: AnalyticsSnapshotRef | null | undefined,
  right: AnalyticsSnapshotRef | null | undefined,
): number {
  return formatReference(left).localeCompare(formatReference(right));
}

export function sortDepartmentLoad(
  rows: readonly AnalyticsDepartmentLoad[],
): AnalyticsDepartmentLoad[] {
  return [...rows].sort((left, right) => byReferenceLabel(left.department, right.department));
}

export function sortInstructorWorkload(
  rows: readonly AnalyticsInstructorWorkload[],
): AnalyticsInstructorWorkload[] {
  return [...rows].sort((left, right) => byReferenceLabel(left.instructor, right.instructor));
}

export function sortRoomUsage(rows: readonly AnalyticsRoomUsage[]): AnalyticsRoomUsage[] {
  return [...rows].sort((left, right) => byReferenceLabel(left.room, right.room));
}

export function sortStudentGroupLoad(
  rows: readonly AnalyticsStudentGroupLoad[],
): AnalyticsStudentGroupLoad[] {
  return [...rows].sort((left, right) => byReferenceLabel(left.group, right.group));
}

/**
 * Weekday distribution as ordered rows.
 *
 * The backend sends a mapping; it is never reordered by locale, because the college
 * week starts on Sunday.
 */
export function weekdayDistribution(
  counts: Record<string, number>,
  dayLabel: (value: number) => string,
): { label: string; value: number }[] {
  return Object.entries(counts)
    .map(([key, value]) => ({ day: Number(key), value }))
    .filter((entry) => Number.isFinite(entry.day))
    .sort((left, right) => left.day - right.day)
    .map((entry) => ({ label: dayLabel(entry.day), value: entry.value }));
}

/** Start-hour distribution as ordered rows (`08:00`, `09:00`, ...). */
export function startHourDistribution(
  counts: Record<string, number>,
): { label: string; value: number }[] {
  return Object.entries(counts)
    .map(([key, value]) => ({ hour: Number(key), value }))
    .filter((entry) => Number.isFinite(entry.hour))
    .sort((left, right) => left.hour - right.hour)
    .map((entry) => ({
      label: `${String(entry.hour).padStart(2, '0')}:00`,
      value: entry.value,
    }));
}

/** Largest value of a distribution, used to scale the inline bars. */
export function maxValue(rows: readonly { value: number }[]): number {
  return rows.reduce((largest, row) => (row.value > largest ? row.value : largest), 0);
}

/** Headline figures of the summary block, in contract order. */
export function summaryEntries(
  report: ScheduleAnalyticsResult,
): { label: string; value: string }[] {
  const { summary } = report;
  return [
    { label: 'Entries', value: formatNumber(summary.entry_count) },
    { label: 'Sessions', value: formatNumber(summary.session_count) },
    { label: 'Scheduled minutes', value: formatNumber(summary.scheduled_minutes) },
    { label: 'Scheduled hours', value: formatHours(summary.scheduled_hours) },
    { label: 'Courses', value: formatNumber(summary.unique_courses) },
    { label: 'Teaching components', value: formatNumber(summary.unique_teaching_components) },
    { label: 'Departments', value: formatNumber(summary.unique_departments) },
    { label: 'Instructors', value: formatNumber(summary.unique_instructors) },
    { label: 'Rooms', value: formatNumber(summary.unique_rooms) },
    { label: 'Student groups', value: formatNumber(summary.unique_student_groups) },
    { label: 'Days used', value: formatNumber(summary.days_used) },
  ];
}
