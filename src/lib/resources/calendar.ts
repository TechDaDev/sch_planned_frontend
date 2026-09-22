/**
 * Calendar-specific rules and helpers.
 *
 * The calendar submodule mixes a recurring weekly grid (working days, time slots,
 * breaks) with dated exceptions, so the distinction is made explicit here rather
 * than being re-derived in every component.
 */

import { EXCEPTION_TYPE_REQUIRED_SCOPE, WEEKDAY_OPTIONS } from '@/lib/resources/constants';
import type {
  ExceptionScope,
  ExceptionType,
  SemesterSummary,
} from '@/lib/resources/types';
import { toMinutes } from '@/lib/resources/validation';

export { WEEKDAY_OPTIONS };

/** Which target field a scope points at; `null` for `COLLEGE`. */
export function scopeTargetField(
  scope: ExceptionScope,
): 'department' | 'instructor' | 'room' | 'student_group' | null {
  switch (scope) {
    case 'DEPARTMENT':
      return 'department';
    case 'INSTRUCTOR':
      return 'instructor';
    case 'ROOM':
      return 'room';
    case 'STUDENT_GROUP':
      return 'student_group';
    default:
      return null;
  }
}

/**
 * Scope the backend pins to one exception type.
 *
 * `INSTRUCTOR_ABSENCE` and `ROOM_CLOSURE` only make sense for their own scope, so
 * the form selects and locks it instead of letting a rejected pair be submitted.
 */
export function requiredScopeFor(
  exceptionType: ExceptionType,
): ExceptionScope | null {
  return EXCEPTION_TYPE_REQUIRED_SCOPE[exceptionType] ?? null;
}

/** Scope the form should use for a type; the current scope when unconstrained. */
export function effectiveScopeFor(
  exceptionType: ExceptionType,
  currentScope: ExceptionScope,
): ExceptionScope {
  return requiredScopeFor(exceptionType) ?? currentScope;
}

export interface ExceptionFormShape {
  is_full_day: string;
  start_time: string;
  end_time: string;
  scope_type: string;
}

/**
 * Full-day exceptions carry no times; partial-day exceptions need both.
 *
 * Returns field errors keyed like the backend's own response so the same problem
 * reads identically whether caught here or by Django.
 */
export function validateExceptionTimeShape(shape: ExceptionFormShape): Record<string, string> {
  const errors: Record<string, string> = {};
  const isFullDay = shape.is_full_day === 'true';
  const start = shape.start_time.trim();
  const end = shape.end_time.trim();

  if (isFullDay) {
    return errors;
  }

  if (start.length === 0 || end.length === 0) {
    errors.start_time =
      'Provide both start and end times for a partial-day exception, or neither for a full-day exception.';
    return errors;
  }

  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null) {
    errors.start_time = 'Enter times as HH:MM.';
    return errors;
  }
  if (startMinutes >= endMinutes) {
    errors.end_time = 'The exception must end after it starts.';
  }
  return errors;
}

/** The target the given scope requires, or `null` when the scope needs none. */
export function validateExceptionTarget(
  scope: ExceptionScope,
  targets: {
    department?: string;
    instructor?: string;
    room?: string;
    student_group?: string;
  },
): Record<string, string> {
  const errors: Record<string, string> = {};
  const field = scopeTargetField(scope);
  if (field === null) {
    return errors;
  }
  const value = (targets[field] ?? '').trim();
  if (value.length === 0) {
    errors[field] = `A ${scope.toLowerCase().replace('_', ' ')} exception requires this target.`;
  }
  return errors;
}

/**
 * The type/scope pairing, phrased like the backend.
 *
 * Mirrors `CalendarException.clean()`: the client never invents its own wording.
 */
export function validateExceptionTypeScope(
  exceptionType: ExceptionType,
  scope: ExceptionScope,
): Record<string, string> {
  const required = requiredScopeFor(exceptionType);
  if (required === null || required === scope) {
    return {};
  }
  const typeLabel = exceptionType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return {
    scope_type: `${typeLabel} must be scoped to ${required.toLowerCase().replace('_', ' ')}.`,
  };
}

/**
 * Optional semester range check.
 *
 * Only applies when the semester actually has configured dates; a semester with
 * `null` boundaries imposes no client-side limit.
 */
export function validateExceptionSemesterDate(
  date: string,
  semester: SemesterSummary | null,
  semesterDates: { start_date: string | null; end_date: string | null } | null,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const trimmed = date.trim();
  if (trimmed.length === 0 || semester === null || semesterDates === null) {
    return errors;
  }
  if (semesterDates.start_date && trimmed < semesterDates.start_date) {
    errors.date = 'The exception date is before the semester starts.';
  } else if (semesterDates.end_date && trimmed > semesterDates.end_date) {
    errors.date = 'The exception date is after the semester ends.';
  }
  return errors;
}

/**
 * Overlap check for the day grid, used only to warn before submitting.
 *
 * The backend remains authoritative; this only helps the user see an obvious
 * conflict immediately. Windows are compared as minutes since midnight.
 */
export function windowsOverlap(
  first: { start_time: string; end_time: string },
  second: { start_time: string; end_time: string },
): boolean {
  const firstStart = toMinutes(first.start_time);
  const firstEnd = toMinutes(first.end_time);
  const secondStart = toMinutes(second.start_time);
  const secondEnd = toMinutes(second.end_time);
  if (
    firstStart === null ||
    firstEnd === null ||
    secondStart === null ||
    secondEnd === null
  ) {
    return false;
  }
  return firstStart < secondEnd && secondStart < firstEnd;
}
