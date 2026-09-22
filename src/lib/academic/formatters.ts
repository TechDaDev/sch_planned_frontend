/**
 * Presentation helpers for academic values.
 *
 * Formatting is deterministic and locale-independent: it never runs
 * `toLocaleString` on data whose value differs between server and client, so
 * rendering a value cannot cause a hydration mismatch.
 */

import {
  componentTypeLabel,
  semesterNumberLabel,
  studyTypeLabel,
} from '@/lib/academic/constants';
import type {
  AcademicYearSummary,
  CourseOffering,
  DecimalString,
  IsoDate,
  IsoDateTime,
  SemesterNumber,
  SemesterSummary,
  StudyType,
  TeachingComponent,
  TeachingComponentType,
} from '@/lib/academic/types';

/** `2026–2027` (en dash, matching the backend's own `__str__`). */
export function formatAcademicYear(year: {
  start_year: number;
  end_year: number;
}): string {
  return `${year.start_year}–${year.end_year}`;
}

export function formatSemester(
  semester: Pick<SemesterSummary, 'number' | 'academic_year'>,
): string {
  return `${formatAcademicYear(semester.academic_year)} · ${semesterNumberLabel(semester.number)} semester`;
}

export function formatSemesterNumber(number: SemesterNumber): string {
  return semesterNumberLabel(number);
}

export function formatStudyType(value: StudyType): string {
  return studyTypeLabel(value);
}

export function formatComponentType(value: TeachingComponentType): string {
  return componentTypeLabel(value);
}

/**
 * Human readable decimal hours: `1.00` becomes `1`, `1.50` becomes `1.5`.
 *
 * Trailing zeros are trimmed for display only; submitted values keep their
 * backend decimal shape.
 */
export function formatHours(value: DecimalString | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const raw = typeof value === 'number' ? String(value) : value;
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    return raw;
  }
  const trimmedInteger = raw.split('.')[0] ?? raw;
  const fraction = raw.split('.')[1];
  if (!fraction) {
    return trimmedInteger;
  }
  const trimmedFraction = fraction.replace(/0+$/, '');
  return trimmedFraction.length === 0
    ? trimmedInteger
    : `${trimmedInteger}.${trimmedFraction}`;
}

export function formatWeeklyHours(value: DecimalString | number | null | undefined): string {
  const formatted = formatHours(value);
  return formatted === '—' ? formatted : `${formatted} h`;
}

export function formatSessionsPerWeek(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return value === 1 ? '1 session' : `${value} sessions`;
}

/** ISO date as returned by the backend; rendered verbatim (no timezone shift). */
export function formatDate(value: IsoDate | null | undefined): string {
  return value ?? '—';
}

/**
 * Timestamp rendered as `YYYY-MM-DD HH:mm` in the viewer's local time.
 *
 * Built from date parts rather than a locale formatter so the output is stable.
 */
export function formatDateTime(value: IsoDateTime | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const pad = (part: number): string => String(part).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** `BIOAI — Stage 2 — Group A`, the disambiguating group label. */
export function formatGroupLabel(group: {
  name: string;
  code: string;
  stage?: { number: number; name?: string } | null;
}): string {
  const stage = group.stage ? ` — Stage ${group.stage.number}` : '';
  return `${group.code}${stage} — ${group.name}`;
}

/** `BIOAI — Stage 2 — Group A` built from flat parts. */
export function formatGroupOption(
  groupCode: string,
  stageNumber: number | null,
  groupName: string,
): string {
  const stage = stageNumber === null ? '' : ` — Stage ${stageNumber}`;
  return `${groupCode}${stage} — ${groupName}`;
}

/** `ML301 — Machine Learning [MAIN]`. */
export function formatOffering(offering: CourseOffering): string {
  return `${offering.course.code} — ${offering.course.name} [${offering.offering_code}]`;
}

export function formatOfferingLabel(offering: {
  offering_code: string;
  course: { code: string; name: string };
}): string {
  return `${offering.course.code} — ${offering.course.name} [${offering.offering_code}]`;
}

export function formatAcademicYearOption(year: AcademicYearSummary): string {
  return formatAcademicYear(year);
}

/** `Theory — Lecture A (2 h × 20 sessions)`. */
export function formatComponentLabel(component: {
  component_type: TeachingComponentType;
  label: string;
  code?: string;
}): string {
  const type = formatComponentType(component.component_type);
  return component.label ? `${type} — ${component.label}` : type;
}

export function describeComponent(component: TeachingComponent): string {
  const parts = [
    formatComponentType(component.component_type),
    component.label || null,
    component.sessions_per_week === null
      ? null
      : `${component.sessions_per_week}/${'week'}`,
  ].filter((part): part is string => part !== null);
  return parts.join(' · ');
}
