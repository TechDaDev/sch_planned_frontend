/**
 * Resource validation helpers.
 *
 * These mirror the obvious client-checkable rules of the backend models so a user
 * gets immediate feedback; the backend stays authoritative for overlap, sharing
 * and eligibility checks, whose messages are displayed verbatim.
 *
 * Times are recurring wall-clock values in the college week. They are compared as
 * minutes since midnight, never as timestamps, and no timezone conversion is ever
 * applied.
 */

import { parseDecimalInput, toScaledInt } from '@/lib/academic/validation';
import type { DecimalString } from '@/lib/resources/types';

export interface ValidationResult {
  errors: Record<string, string>;
}

/** `HH:MM[:SS]` or `HH:MM` as minutes since midnight, or `null` if unusable. */
export function toMinutes(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1] ?? '0');
  const minutes = Number(match[2] ?? '0');
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Normalize a backend time (`HH:MM:SS`) to an `<input type="time">` value. */
export function toTimeInputValue(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const match = /^(\d{1,2}:\d{2})/.exec(value.trim());
  return match ? (match[1]?.padStart(5, '0') ?? '') : '';
}

export function isTimeProvided(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Optional workload limits.
 *
 * Absent means "no limit" and must stay `null`: a blank input is never sent as
 * zero, because zero is rejected by the backend.
 */
export function validateWorkloadLimits(
  weeklyHours: string,
  dailyHours: string,
  labels: {
    weekly?: string;
    daily?: string;
    dailyExceedsWeekly?: string;
  } = {},
): ValidationResult {
  const errors: Record<string, string> = {};
  const weeklyLabel = labels.weekly ?? 'max_weekly_hours';
  const dailyLabel = labels.daily ?? 'max_daily_hours';
  const weekly = weeklyHours.trim();
  const daily = dailyHours.trim();

  const weeklyValue = weekly.length === 0 ? null : parseDecimalInput(weekly);
  const dailyValue = daily.length === 0 ? null : parseDecimalInput(daily);

  if (weekly.length > 0) {
    if (weeklyValue === null) {
      errors[weeklyLabel] = 'Enter hours as a number with up to two decimals.';
    } else if ((toScaledInt(weeklyValue) ?? 0) <= 0) {
      errors[weeklyLabel] = 'Workload limits must be greater than zero.';
    }
  }

  if (daily.length > 0) {
    if (dailyValue === null) {
      errors[dailyLabel] = 'Enter hours as a number with up to two decimals.';
    } else if ((toScaledInt(dailyValue) ?? 0) <= 0) {
      errors[dailyLabel] = 'Workload limits must be greater than zero.';
    }
  }

  if (
    weeklyValue !== null &&
    dailyValue !== null &&
    errors[weeklyLabel] === undefined &&
    errors[dailyLabel] === undefined
  ) {
    const weeklyScaled = toScaledInt(weeklyValue) ?? 0;
    const dailyScaled = toScaledInt(dailyValue) ?? 0;
    if (dailyScaled > weeklyScaled) {
      errors[dailyLabel] =
        labels.dailyExceedsWeekly ??
        'The daily hour limit cannot exceed the weekly hour limit.';
    }
  }

  return { errors };
}

/** Normalize a workload input for submission: blank stays `null`. */
export function workloadValue(raw: string): DecimalString | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return parseDecimalInput(trimmed) ?? null;
}

/**
 * Recurring window ordering.
 *
 * The message mirrors the backend's per-table wording so the same problem reads
 * identically wherever it is caught.
 */
export function validateTimeWindow(
  startTime: string,
  endTime: string,
  options: { endMessage?: string; requireBoth?: boolean } = {},
): ValidationResult {
  const errors: Record<string, string> = {};
  const requireBoth = options.requireBoth ?? true;
  const endMessage = options.endMessage ?? 'End time must be after the start time.';
  const start = startTime.trim();
  const end = endTime.trim();

  if (requireBoth && (start.length === 0 || end.length === 0)) {
    if (start.length === 0) {
      errors.start_time = 'Start time is required.';
    }
    if (end.length === 0) {
      errors.end_time = 'End time is required.';
    }
    return { errors };
  }

  if (start.length === 0 || end.length === 0) {
    return { errors };
  }

  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null) {
    errors.start_time = 'Enter times as HH:MM.';
    return { errors };
  }
  if (startMinutes >= endMinutes) {
    errors.end_time = endMessage;
  }
  return { errors };
}

/** Room capacity: `>= 1`. */
export function validateCapacity(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Capacity is required.';
  }
  if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) {
    return 'Capacity must be at least 1.';
  }
  return null;
}

/** Time slot sequence: `>= 1`. */
export function validateSequence(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Sequence is required.';
  }
  if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) {
    return 'Sequence must be 1 or greater.';
  }
  return null;
}

/** Optional minimum capacity override: blank means "use the student count". */
export function validateMinimumCapacity(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) {
    return 'Minimum capacity must be greater than zero.';
  }
  return null;
}

/** Optional numeric parse that keeps blank as `null`. */
export function optionalInteger(value: string): number | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : Number(trimmed);
}
