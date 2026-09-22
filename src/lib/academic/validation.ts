/**
 * Academic validation helpers.
 *
 * These mirror the obvious client-side rules of the backend models, so a user
 * gets immediate feedback. They never replace the backend, whose validation
 * errors are displayed alongside these.
 *
 * Decimal values are compared as scaled integers (the backend uses
 * `max_digits=5, decimal_places=2`), so whole-session checks cannot be fooled by
 * binary floating point.
 */

import type { DecimalString } from '@/lib/academic/types';

/** Backend `DecimalField(max_digits=5, decimal_places=2)`. */
export const DECIMAL_SCALE = 2;

const DECIMAL_INPUT = /^\d{1,3}(\.\d{1,2})?$/;

export interface ValidationResult {
  /** Field name to message. */
  errors: Record<string, string>;
}

/**
 * Parse user input into a backend-compatible decimal string.
 *
 * Returns `null` when the input is not a positive-or-zero decimal with at most
 * two fraction digits. Empty input is `null` as well, and callers decide whether
 * that means "missing".
 */
export function parseDecimalInput(raw: string): DecimalString | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!DECIMAL_INPUT.test(trimmed)) {
    return null;
  }
  const scaled = toScaledInt(trimmed);
  if (scaled === null) {
    return null;
  }
  return fromScaledInt(scaled);
}

/** Exact integer representation of a decimal string at a fixed scale. */
export function toScaledInt(
  value: DecimalString | number | null | undefined,
  scale: number = DECIMAL_SCALE,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return null;
  }
  const [integerPart, fractionPart = ''] = raw.split('.');
  if (fractionPart.length > scale) {
    // Reject values finer than the backend can store rather than rounding.
    return null;
  }
  const paddedFraction = fractionPart.padEnd(scale, '0');
  const scaled = Number(`${integerPart}${paddedFraction}`);
  return Number.isSafeInteger(scaled) ? scaled : null;
}

export function fromScaledInt(scaled: number, scale: number = DECIMAL_SCALE): DecimalString {
  const digits = String(Math.abs(scaled)).padStart(scale + 1, '0');
  const integerPart = digits.slice(0, digits.length - scale);
  const fractionPart = digits.slice(digits.length - scale);
  const sign = scaled < 0 ? '-' : '';
  return `${sign}${integerPart}.${fractionPart}`;
}

export function isPositiveDecimal(value: DecimalString | number): boolean {
  const scaled = toScaledInt(value);
  return scaled !== null && scaled > 0;
}

/**
 * Whole number of sessions per week, or `null` when the inputs do not divide
 * exactly.
 *
 * The backend rejects a fractional result instead of rounding.
 */
export function wholeSessionsPerWeek(
  weeklyHours: DecimalString,
  sessionDurationHours: DecimalString,
): number | null {
  const weekly = toScaledInt(weeklyHours);
  const duration = toScaledInt(sessionDurationHours);
  if (weekly === null || duration === null || duration <= 0 || weekly <= 0) {
    return null;
  }
  if (weekly % duration !== 0) {
    return null;
  }
  return weekly / duration;
}

export interface TeachingComponentHoursInput {
  weekly_hours: string;
  session_duration_hours: string;
}

/**
 * Client-side mirror of `TeachingComponent.clean()`.
 *
 * Mirrors the backend messages where they exist, so an identical problem reads
 * the same whether it is caught here or by Django.
 */
export function validateTeachingComponentHours(
  input: TeachingComponentHoursInput,
): ValidationResult {
  const errors: Record<string, string> = {};
  const weekly = parseDecimalInput(input.weekly_hours);
  const duration = parseDecimalInput(input.session_duration_hours);

  if (input.weekly_hours.trim().length === 0) {
    errors.weekly_hours = 'Weekly hours are required.';
  } else if (weekly === null) {
    errors.weekly_hours = 'Enter hours as a number with up to two decimals.';
  } else if (!isPositiveDecimal(weekly)) {
    errors.weekly_hours = 'Weekly hours must be greater than zero.';
  }

  if (input.session_duration_hours.trim().length === 0) {
    errors.session_duration_hours = 'Session duration is required.';
  } else if (duration === null) {
    errors.session_duration_hours = 'Enter hours as a number with up to two decimals.';
  } else if (!isPositiveDecimal(duration)) {
    errors.session_duration_hours = 'Session duration must be greater than zero.';
  }

  if (Object.keys(errors).length > 0 || weekly === null || duration === null) {
    return { errors };
  }

  const weeklyScaled = toScaledInt(weekly);
  const durationScaled = toScaledInt(duration);
  if (weeklyScaled === null || durationScaled === null) {
    return { errors };
  }

  if (weeklyScaled < durationScaled) {
    errors.weekly_hours = 'Weekly hours must be at least one session duration.';
    return { errors };
  }

  if (weeklyScaled % durationScaled !== 0) {
    errors.session_duration_hours =
      'Session duration must divide the weekly hours into whole sessions; rounding is not applied.';
  }

  return { errors };
}

/** Academic years must be consecutive (`end_year = start_year + 1`). */
export function validateAcademicYearRange(
  startYear: string,
  endYear: string,
): ValidationResult {
  const errors: Record<string, string> = {};
  const start = Number(startYear.trim());
  const end = Number(endYear.trim());

  if (startYear.trim().length === 0 || !Number.isInteger(start) || start < 1) {
    errors.start_year = 'Enter the starting year, for example 2026.';
  }
  if (endYear.trim().length === 0 || !Number.isInteger(end) || end < 1) {
    errors.end_year = 'Enter the ending year, for example 2027.';
  }
  if (Object.keys(errors).length > 0) {
    return { errors };
  }
  if (end !== start + 1) {
    errors.end_year = 'End year must be exactly one year after the start year.';
  }
  return { errors };
}

/** Semester dates are optional, but a supplied range must be ordered. */
export function validateSemesterDates(startDate: string, endDate: string): ValidationResult {
  const errors: Record<string, string> = {};
  const start = startDate.trim();
  const end = endDate.trim();
  if (start.length === 0 || end.length === 0) {
    return { errors };
  }
  if (end < start) {
    errors.end_date = 'End date must be on or after the start date.';
  }
  return { errors };
}

/**
 * Suggest the end year for a start year (`2026` becomes `2027`).
 *
 * Returns `null` when the input is not a usable year.
 */
export function suggestedEndYear(startYear: string): string | null {
  const start = Number(startYear.trim());
  if (!Number.isInteger(start) || start < 1) {
    return null;
  }
  return String(start + 1);
}

/** Non-negative integer check for `student_count`. */
export function validateStudentCount(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Student count is required.';
  }
  if (!/^\d+$/.test(trimmed)) {
    return 'Student count must be a whole number, zero or greater.';
  }
  return null;
}

/** Positive integer check used by `StudyStage.number`. */
export function validatePositiveInteger(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return `${label} is required.`;
  }
  if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) {
    return `${label} must be a whole number greater than zero.`;
  }
  return null;
}
