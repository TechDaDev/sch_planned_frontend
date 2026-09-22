import { describe, expect, it } from 'vitest';

import {
  WEEKDAY_OPTIONS,
  effectiveScopeFor,
  requiredScopeFor,
  scopeTargetField,
  validateExceptionSemesterDate,
  validateExceptionTarget,
  validateExceptionTimeShape,
  validateExceptionTypeScope,
  windowsOverlap,
} from '@/lib/resources/calendar';
import {
  formatExceptionType,
  formatMinutes,
  formatTimeRange,
  formatWeekday,
} from '@/lib/resources/formatters';
import { breakPeriodFields, timeSlotFields, workingDayFields } from '@/lib/resources/forms';
import type { FormFieldSpec } from '@/lib/resources/forms';
import {
  optionalInteger,
  toMinutes,
  validateCapacity,
  validateMinimumCapacity,
  validateSequence,
  validateTimeWindow,
} from '@/lib/resources/validation';
import { workingDayRow } from '@/test/resource-fixtures';

function field(fields: readonly FormFieldSpec[], name: string): FormFieldSpec {
  const found = fields.find((candidate) => candidate.name === name);
  if (!found) {
    throw new Error(`Field "${name}" is not part of the form.`);
  }
  return found;
}

describe('weekday encoding', () => {
  it('uses the shared college week starting on Sunday', () => {
    expect(formatWeekday(0)).toBe('Sunday');
    expect(formatWeekday(1)).toBe('Monday');
    expect(formatWeekday(2)).toBe('Tuesday');
    expect(formatWeekday(3)).toBe('Wednesday');
    expect(formatWeekday(4)).toBe('Thursday');
    expect(formatWeekday(null)).toBe('—');
  });

  it('offers exactly Sunday to Thursday as selectable values', () => {
    expect(WEEKDAY_OPTIONS.map((option) => option.value)).toEqual(['0', '1', '2', '3', '4']);
    expect(WEEKDAY_OPTIONS.map((option) => option.label)).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
    ]);
  });

  it('never falls back to the JavaScript weekday numbering', () => {
    // JavaScript treats Sunday as 0 too, but Monday is 1 there and here; the
    // guard is that only 0..4 are ever rendered as college weekdays.
    expect(formatWeekday(5)).toBe('Day 5');
  });
});

describe('working days', () => {
  it('requires the day to end after it starts', () => {
    const endTime = field(workingDayFields([]), 'end_time');
    expect(
      endTime.validate?.('08:00', { start_time: '08:00', end_time: '08:00' }),
    ).toBe('The working day must end after it starts.');
    expect(
      endTime.validate?.('16:00', { start_time: '08:00', end_time: '16:00' }),
    ).toBeNull();
  });

  it('keeps the college week meaning visible in the form', () => {
    const weekday = field(workingDayFields([]), 'day_of_week');
    expect(weekday.helpText).toMatch(/Sunday to Thursday/);
  });

  it('reads a working day row with its display values', () => {
    const day = workingDayRow();
    expect(day.day_of_week_code).toBe('SUNDAY');
    expect(day.day_of_week_display).toBe('Sunday');
    expect(formatTimeRange(day.start_time, day.end_time)).toBe('08:00–16:00');
  });
});

describe('time slots and breaks', () => {
  it('requires a sequence of at least one', () => {
    expect(validateSequence('0')).toBe('Sequence must be 1 or greater.');
    expect(validateSequence('')).toBe('Sequence is required.');
    expect(validateSequence('3')).toBeNull();

    const sequence = field(timeSlotFields([]), 'sequence');
    expect(sequence.validate?.('0', {})).toBe('Sequence must be 1 or greater.');
  });

  it('requires the slot to end after it starts', () => {
    const endTime = field(timeSlotFields([]), 'end_time');
    expect(endTime.validate?.('08:00', { start_time: '08:30', end_time: '08:00' })).toBe(
      'The time slot must end after it starts.',
    );
  });

  it('requires the break to end after it starts', () => {
    const endTime = field(breakPeriodFields([]), 'end_time');
    expect(endTime.validate?.('12:00', { start_time: '12:00', end_time: '12:00' })).toBe(
      'The break must end after it starts.',
    );
  });

  it('displays a derived duration and accepts varying lengths', () => {
    expect(formatMinutes(90)).toBe('90 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(null)).toBe('—');
  });

  it('detects overlapping windows without recreating the backend rule', () => {
    expect(
      windowsOverlap({ start_time: '08:00', end_time: '09:30' }, { start_time: '09:00', end_time: '10:00' }),
    ).toBe(true);
    expect(
      windowsOverlap({ start_time: '08:00', end_time: '09:00' }, { start_time: '09:00', end_time: '10:00' }),
    ).toBe(false);
  });

  it('parses times as minutes since midnight', () => {
    expect(toMinutes('08:30')).toBe(510);
    expect(toMinutes('08:30:00')).toBe(510);
    expect(toMinutes('24:00')).toBeNull();
    expect(toMinutes('')).toBeNull();
  });
});

describe('calendar exceptions — time shape', () => {
  it('accepts a full-day exception without times', () => {
    expect(
      validateExceptionTimeShape({
        is_full_day: 'true',
        start_time: '08:00',
        end_time: '10:00',
        scope_type: 'COLLEGE',
      }),
    ).toEqual({});
  });

  it('requires both times for a partial-day exception', () => {
    expect(
      validateExceptionTimeShape({
        is_full_day: 'false',
        start_time: '08:00',
        end_time: '',
        scope_type: 'COLLEGE',
      }).start_time,
    ).toBe(
      'Provide both start and end times for a partial-day exception, or neither for a full-day exception.',
    );
  });

  it('requires the partial-day exception to end after it starts', () => {
    expect(
      validateExceptionTimeShape({
        is_full_day: 'false',
        start_time: '10:00',
        end_time: '09:00',
        scope_type: 'COLLEGE',
      }).end_time,
    ).toBe('The exception must end after it starts.');
  });
});

describe('calendar exceptions — scope and target pairing', () => {
  it('maps each scope to its target field', () => {
    expect(scopeTargetField('COLLEGE')).toBeNull();
    expect(scopeTargetField('DEPARTMENT')).toBe('department');
    expect(scopeTargetField('INSTRUCTOR')).toBe('instructor');
    expect(scopeTargetField('ROOM')).toBe('room');
    expect(scopeTargetField('STUDENT_GROUP')).toBe('student_group');
  });

  it('requires the target the scope points at', () => {
    expect(validateExceptionTarget('COLLEGE', {})).toEqual({});
    expect(validateExceptionTarget('ROOM', { room: '' }).room).toContain('requires this target');
    expect(validateExceptionTarget('ROOM', { room: '22' })).toEqual({});
  });

  it('pins instructor absence to the instructor scope', () => {
    expect(requiredScopeFor('INSTRUCTOR_ABSENCE')).toBe('INSTRUCTOR');
    expect(effectiveScopeFor('INSTRUCTOR_ABSENCE', 'COLLEGE')).toBe('INSTRUCTOR');
    expect(validateExceptionTypeScope('INSTRUCTOR_ABSENCE', 'ROOM').scope_type).toContain(
      'scoped to instructor',
    );
    expect(validateExceptionTypeScope('INSTRUCTOR_ABSENCE', 'INSTRUCTOR')).toEqual({});
  });

  it('pins room closure to the room scope', () => {
    expect(requiredScopeFor('ROOM_CLOSURE')).toBe('ROOM');
    expect(validateExceptionTypeScope('ROOM_CLOSURE', 'COLLEGE').scope_type).toContain(
      'scoped to room',
    );
    expect(validateExceptionTypeScope('ROOM_CLOSURE', 'ROOM')).toEqual({});
  });

  it('leaves other types free to use a valid scope', () => {
    expect(requiredScopeFor('HOLIDAY')).toBeNull();
    expect(validateExceptionTypeScope('HOLIDAY', 'DEPARTMENT')).toEqual({});
    expect(effectiveScopeFor('HOLIDAY', 'DEPARTMENT')).toBe('DEPARTMENT');
  });

  it('labels the exception type for display', () => {
    expect(formatExceptionType('INSTRUCTOR_ABSENCE')).toBe('Instructor absence');
    expect(formatExceptionType('ROOM_CLOSURE')).toBe('Room closure');
  });
});

describe('calendar exceptions — semester range', () => {
  const semester = { id: 8, number: 1 as const, academic_year: { id: 3, start_year: 2026, end_year: 2027 } };

  it('checks the date against configured semester dates', () => {
    expect(
      validateExceptionSemesterDate('2026-08-01', semester, {
        start_date: '2026-09-01',
        end_date: '2027-01-15',
      }).date,
    ).toBe('The exception date is before the semester starts.');

    expect(
      validateExceptionSemesterDate('2027-02-01', semester, {
        start_date: '2026-09-01',
        end_date: '2027-01-15',
      }).date,
    ).toBe('The exception date is after the semester ends.');

    expect(
      validateExceptionSemesterDate('2026-10-01', semester, {
        start_date: '2026-09-01',
        end_date: '2027-01-15',
      }),
    ).toEqual({});
  });

  it('invents no boundary when the semester has none', () => {
    expect(
      validateExceptionSemesterDate('2030-01-01', semester, {
        start_date: null,
        end_date: null,
      }),
    ).toEqual({});
    expect(validateExceptionSemesterDate('2030-01-01', null, null)).toEqual({});
  });
});

describe('numeric validation helpers', () => {
  it('requires capacity of at least one', () => {
    expect(validateCapacity('0')).toBe('Capacity must be at least 1.');
    expect(validateCapacity('')).toBe('Capacity is required.');
    expect(validateCapacity('30')).toBeNull();
  });

  it('keeps the minimum capacity override optional and positive', () => {
    expect(validateMinimumCapacity('')).toBeNull();
    expect(validateMinimumCapacity('0')).toBe('Minimum capacity must be greater than zero.');
    expect(validateMinimumCapacity('25')).toBeNull();
  });

  it('parses optional integers without turning blank into zero', () => {
    expect(optionalInteger('')).toBeNull();
    expect(optionalInteger('  ')).toBeNull();
    expect(optionalInteger('25')).toBe(25);
  });

  it('validates a generic window when both times are required', () => {
    expect(validateTimeWindow('', '')).toMatchObject({
      errors: { start_time: 'Start time is required.' },
    });
    expect(validateTimeWindow('08:00', '08:00').errors.end_time).toBe(
      'End time must be after the start time.',
    );
    expect(validateTimeWindow('08:00', '09:00').errors).toEqual({});
  });
});
