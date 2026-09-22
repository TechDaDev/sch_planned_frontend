import { describe, expect, it } from 'vitest';

import {
  fromScaledInt,
  parseDecimalInput,
  suggestedEndYear,
  toScaledInt,
  validateAcademicYearRange,
  validatePositiveInteger,
  validateSemesterDates,
  validateStudentCount,
  validateTeachingComponentHours,
  wholeSessionsPerWeek,
} from '@/lib/academic/validation';

describe('decimal parsing', () => {
  it('accepts backend-shaped input', () => {
    expect(parseDecimalInput('1')).toBe('1.00');
    expect(parseDecimalInput('1.5')).toBe('1.50');
    expect(parseDecimalInput('2.00')).toBe('2.00');
    expect(parseDecimalInput(' 3.25 ')).toBe('3.25');
  });

  it('rejects input the backend could not store', () => {
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput('-1')).toBeNull();
    expect(parseDecimalInput('1.234')).toBeNull();
    expect(parseDecimalInput('abc')).toBeNull();
    expect(parseDecimalInput('1e3')).toBeNull();
  });

  it('round-trips through scaled integers', () => {
    expect(toScaledInt('1.5')).toBe(150);
    expect(fromScaledInt(150)).toBe('1.50');
    expect(toScaledInt('1.234')).toBeNull();
  });
});

describe('whole sessions per week', () => {
  it('computes whole sessions', () => {
    expect(wholeSessionsPerWeek('3.00', '1.50')).toBe(2);
    expect(wholeSessionsPerWeek('2.00', '1.00')).toBe(2);
    expect(wholeSessionsPerWeek('1.50', '0.50')).toBe(3);
  });

  it('is exact rather than floating point based', () => {
    // 0.3 / 0.1 is 2.9999999999999996 in binary floating point.
    expect(wholeSessionsPerWeek('0.30', '0.10')).toBe(3);
  });

  it('returns null when the hours do not divide exactly', () => {
    expect(wholeSessionsPerWeek('3.00', '2.00')).toBeNull();
    expect(wholeSessionsPerWeek('1.00', '1.50')).toBeNull();
    expect(wholeSessionsPerWeek('0.00', '1.00')).toBeNull();
  });
});

describe('teaching component hours', () => {
  it('accepts positive hours that divide into whole sessions', () => {
    expect(
      validateTeachingComponentHours({
        weekly_hours: '3',
        session_duration_hours: '1.5',
      }).errors,
    ).toEqual({});
  });

  it('mirrors the backend messages', () => {
    expect(
      validateTeachingComponentHours({
        weekly_hours: '0',
        session_duration_hours: '1',
      }).errors.weekly_hours,
    ).toBe('Weekly hours must be greater than zero.');

    expect(
      validateTeachingComponentHours({
        weekly_hours: '1',
        session_duration_hours: '0',
      }).errors.session_duration_hours,
    ).toBe('Session duration must be greater than zero.');

    expect(
      validateTeachingComponentHours({
        weekly_hours: '1',
        session_duration_hours: '1.5',
      }).errors.weekly_hours,
    ).toBe('Weekly hours must be at least one session duration.');

    expect(
      validateTeachingComponentHours({
        weekly_hours: '3',
        session_duration_hours: '2',
      }).errors.session_duration_hours,
    ).toBe(
      'Session duration must divide the weekly hours into whole sessions; rounding is not applied.',
    );
  });

  it('reports missing fields', () => {
    const { errors } = validateTeachingComponentHours({
      weekly_hours: '',
      session_duration_hours: '',
    });
    expect(errors.weekly_hours).toBe('Weekly hours are required.');
    expect(errors.session_duration_hours).toBe('Session duration is required.');
  });
});

describe('academic year range', () => {
  it('accepts consecutive years', () => {
    expect(validateAcademicYearRange('2026', '2027').errors).toEqual({});
  });

  it('requires the end year to be exactly one year later', () => {
    expect(validateAcademicYearRange('2026', '2028').errors.end_year).toBe(
      'End year must be exactly one year after the start year.',
    );
    expect(validateAcademicYearRange('2026', '2026').errors.end_year).toBe(
      'End year must be exactly one year after the start year.',
    );
  });

  it('suggests the end year', () => {
    expect(suggestedEndYear('2026')).toBe('2027');
    expect(suggestedEndYear('')).toBeNull();
    expect(suggestedEndYear('abc')).toBeNull();
  });
});

describe('other academic validation', () => {
  it('orders optional semester dates', () => {
    expect(validateSemesterDates('', '').errors).toEqual({});
    expect(validateSemesterDates('2026-09-01', '').errors).toEqual({});
    expect(validateSemesterDates('2026-09-01', '2026-08-01').errors.end_date).toBe(
      'End date must be on or after the start date.',
    );
    expect(validateSemesterDates('2026-09-01', '2026-09-01').errors).toEqual({});
  });

  it('validates student counts', () => {
    expect(validateStudentCount('0')).toBeNull();
    expect(validateStudentCount('42')).toBeNull();
    expect(validateStudentCount('-1')).toBe('Student count must be a whole number, zero or greater.');
    expect(validateStudentCount('')).toBe('Student count is required.');
  });

  it('validates positive integers', () => {
    expect(validatePositiveInteger('1', 'Stage number')).toBeNull();
    expect(validatePositiveInteger('0', 'Stage number')).toBe(
      'Stage number must be a whole number greater than zero.',
    );
  });
});
