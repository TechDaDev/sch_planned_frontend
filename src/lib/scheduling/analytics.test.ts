import { describe, expect, it } from 'vitest';

import {
  formatDecimal,
  formatHours,
  formatNumber,
  formatPercent,
  formatReference,
  maxValue,
  roomUtilizationExceedsAvailability,
  roomUtilizationView,
  sortDepartmentLoad,
  sortInstructorWorkload,
  sortRoomUsage,
  sortStudentGroupLoad,
  startHourDistribution,
  summaryEntries,
  weekdayDistribution,
} from '@/lib/scheduling/analytics';
import { ROOM_AVAILABILITY_MISSING_LABEL } from '@/lib/scheduling/constants';
import { formatDay } from '@/lib/scheduling/formatters';
import {
  CS_DEPARTMENT,
  BIOAI_DEPARTMENT,
} from '@/test/scheduling-fixtures';
import {
  analyticsResult,
  analyticsSummary,
  departmentLoad,
  instructorWorkload,
  roomUsage,
  studentGroupLoad,
} from '@/test/f4-fixtures';

describe('snapshot reference formatting', () => {
  it('renders `CODE — Name` from the report’s own snapshot', () => {
    expect(formatReference({ id: 2, code: 'BIOAI', name: 'Biomedical AI' })).toBe(
      'BIOAI — Biomedical AI',
    );
    expect(formatReference({ id: 1, name: 'Rana Salim' })).toBe('Rana Salim');
    expect(formatReference({ id: 22, code: 'AI-LAB-1' })).toBe('AI-LAB-1');
  });

  it('states an absence instead of inventing a label', () => {
    expect(formatReference(null)).toBe('—');
    expect(formatReference(undefined)).toBe('—');
    expect(formatReference({ id: 5 })).toBe('#5');
    expect(formatReference({})).toBe('—');
  });
});

describe('numeric formatting', () => {
  it('formats hours, counts, decimals and percentages', () => {
    expect(formatHours(12)).toBe('12.0 h');
    expect(formatHours(7.5)).toBe('7.5 h');
    expect(formatHours(null)).toBe('—');
    expect(formatHours(undefined)).toBe('—');
    expect(formatNumber(12)).toBe('12');
    expect(formatNumber(null)).toBe('—');
    expect(formatDecimal(4.2)).toBe('4.2');
    expect(formatDecimal(4.25, 2)).toBe('4.25');
    expect(formatPercent(40)).toBe('40.0%');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('room utilization display', () => {
  it('reports the current-configuration denominator and the percentage beside it', () => {
    const view = roomUtilizationView(roomUsage());

    expect(view.availabilityLabel).toBe('10.0 h across the current grid');
    expect(view.utilizationLabel).toBe('40.0%');
    expect(view.mismatch).toBe(false);
  });

  it('states a missing denominator in words instead of showing `0%`', () => {
    const view = roomUtilizationView(
      roomUsage({ available_minutes: null, available_hours: null, utilization_percent: null }),
    );

    expect(view.availabilityLabel).toBe(ROOM_AVAILABILITY_MISSING_LABEL);
    expect(view.utilizationLabel).toBe('—');
    expect(view.utilizationLabel).not.toContain('0');
  });

  it('never clamps a percentage above 100', () => {
    const room = roomUsage({
      occupied_minutes: 900,
      occupied_hours: 15,
      available_minutes: 600,
      available_hours: 10,
      utilization_percent: 150,
      configuration_mismatch: true,
    });

    expect(roomUtilizationView(room).utilizationLabel).toBe('150.0%');
    expect(roomUtilizationView(room).mismatch).toBe(true);
    expect(roomUtilizationExceedsAvailability(room)).toBe(true);
  });

  it('does not treat a normal percentage as a mismatch', () => {
    expect(roomUtilizationExceedsAvailability(roomUsage({ utilization_percent: 100 }))).toBe(false);
    expect(roomUtilizationExceedsAvailability(roomUsage({ utilization_percent: null }))).toBe(false);
  });
});

describe('table ordering', () => {
  it('orders by the snapshot label without mutating the input', () => {
    const rows = [
      departmentLoad({ department: CS_DEPARTMENT }),
      departmentLoad({ department: BIOAI_DEPARTMENT }),
    ];
    const ordered = sortDepartmentLoad(rows);

    expect(ordered.map((row) => row.department.code)).toEqual(['BIOAI', 'CS']);
    expect(rows.map((row) => row.department.code)).toEqual(['CS', 'BIOAI']);
  });

  it('orders instructors, rooms and groups by their labels', () => {
    expect(
      sortInstructorWorkload([
        instructorWorkload({ instructor: { id: 2, name: 'Zara Nasser' } }),
        instructorWorkload({ instructor: { id: 1, name: 'Amal Hassan' } }),
      ]).map((row) => row.instructor.name),
    ).toEqual(['Amal Hassan', 'Zara Nasser']);

    expect(
      sortRoomUsage([
        roomUsage({ room: { id: 2, code: 'B-201' } }),
        roomUsage({ room: { id: 1, code: 'A-101' } }),
      ]).map((row) => row.room.code),
    ).toEqual(['A-101', 'B-201']);

    expect(
      sortStudentGroupLoad([
        studentGroupLoad({ group: { id: 2, code: 'CS-2' } }),
        studentGroupLoad({ group: { id: 1, code: 'BIOAI-1' } }),
      ]).map((row) => row.group.code),
    ).toEqual(['BIOAI-1', 'CS-2']);
  });
});

describe('distributions', () => {
  it('keeps the college week in weekday order, whatever the key order is', () => {
    const rows = weekdayDistribution({ '2': 3, '0': 4, '1': 2 }, formatDay);

    expect(rows.map((row) => row.value)).toEqual([4, 2, 3]);
    expect(rows[0]!.label).toBe(formatDay(0));
  });

  it('ignores a non-numeric weekday key rather than printing it', () => {
    expect(weekdayDistribution({ '0': 1, summary: 9 }, formatDay)).toHaveLength(1);
  });

  it('orders start hours and labels them as clock times', () => {
    const rows = startHourDistribution({ '10': 6, '8': 4, '9': 1 });

    expect(rows).toEqual([
      { label: '08:00', value: 4 },
      { label: '09:00', value: 1 },
      { label: '10:00', value: 6 },
    ]);
  });

  it('scales from the largest value and survives an empty distribution', () => {
    expect(maxValue([{ value: 3 }, { value: 9 }, { value: 4 }])).toBe(9);
    expect(maxValue([])).toBe(0);
  });
});

describe('analytics summary block', () => {
  it('reports the eleven headline figures in contract order', () => {
    const entries = summaryEntries(analyticsResult({ summary: analyticsSummary() }));

    expect(entries.map((entry) => entry.label)).toEqual([
      'Entries',
      'Sessions',
      'Scheduled minutes',
      'Scheduled hours',
      'Courses',
      'Teaching components',
      'Departments',
      'Instructors',
      'Rooms',
      'Student groups',
      'Days used',
    ]);
    expect(entries[0]!.value).toBe('12');
    expect(entries[3]!.value).toBe('12.0 h');
  });

  it('never produces a combined quality, efficiency or score figure', () => {
    const report = analyticsResult();
    const labels = summaryEntries(report).map((entry) => entry.label.toLowerCase());

    expect(labels.some((label) => label.includes('score'))).toBe(false);
    expect(labels.some((label) => label.includes('efficiency'))).toBe(false);
    expect(labels.some((label) => label.includes('quality'))).toBe(false);
    // The quality block itself is a set of interpretable figures.
    expect(Object.keys(report.quality)).not.toContain('score');
    expect(Object.keys(report.quality)).not.toContain('composite');
  });
});
