import { describe, expect, it } from 'vitest';

import {
  collectFilterOptions,
  durationMinutes,
  filterSessions,
  sessionFromEntry,
  sessionFromPlacement,
  sessionsFromEntries,
  sessionsFromPlacements,
  sortSessions,
  toClockTime,
  toMinutes,
} from '@/lib/scheduling/normalization';
import {
  collegePlacement,
  placement,
  scheduleEntry,
  VALIDATION_SEMESTER,
} from '@/test/scheduling-fixtures';
import { formatDay } from '@/lib/scheduling/formatters';

describe('time helpers', () => {
  it('normalizes a wall-clock time without shifting it', () => {
    expect(toClockTime('08:30:00')).toBe('08:30');
    expect(toClockTime('08:30')).toBe('08:30');
    expect(toClockTime('13:05:00')).toBe('13:05');
    expect(toClockTime('')).toBe('');
    expect(toClockTime(null)).toBe('');
  });

  it('converts to minutes since midnight', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('08:30')).toBe(510);
    expect(toMinutes('23:59')).toBe(1439);
    expect(toMinutes('')).toBeNull();
  });

  it('measures a duration from the session start and end, not from a fixed period', () => {
    expect(durationMinutes('08:00', '09:30')).toBe(90);
    expect(durationMinutes('08:00', '08:45')).toBe(45);
    expect(durationMinutes('10:00', '09:00')).toBeNull();
  });
});

describe('preview placement normalization', () => {
  it('keeps a multi-period session as one event spanning its slots', () => {
    const session = sessionFromPlacement(placement());

    expect(session.slots).toHaveLength(2);
    expect(session.startTime).toBe('08:00');
    expect(session.endTime).toBe('10:00');
    expect(durationMinutes(session.startTime, session.endTime)).toBe(120);
    expect(session.source).toBe('PREVIEW');
  });

  it('keeps a joint session as one session listing every student group', () => {
    const session = sessionFromPlacement(
      placement({
        student_groups: [
          { id: 40, code: 'BIOAI-1', name: 'Biomedical AI Year 1' },
          { id: 41, code: 'CS-3', name: 'Computer Science Year 3' },
        ],
      }),
    );

    expect(session.studentGroups.map((group) => group.code)).toEqual(['BIOAI-1', 'CS-3']);
  });

  it('carries every instructor with its assignment role', () => {
    const session = sessionFromPlacement(
      placement({
        instructors: [
          { id: 1, full_name: 'Rana Salim', assignment_role: 'PRIMARY' },
          { id: 2, full_name: 'Omar Idris', assignment_role: null },
        ],
      }),
    );

    expect(session.instructors).toEqual([
      { id: 1, fullName: 'Rana Salim', assignmentRole: 'PRIMARY' },
      { id: 2, fullName: 'Omar Idris', assignmentRole: null },
    ]);
  });

  it('accepts a placement without a room', () => {
    const session = sessionFromPlacement(placement({ room: null }));
    expect(session.room).toBeNull();
  });

  it('takes the managing department of a college placement', () => {
    const session = sessionFromPlacement(collegePlacement());
    expect(session.managingDepartment?.code).toBe('BIOAI');
  });

  it('falls back to the requested department when the payload omits it', () => {
    const session = sessionFromPlacement(placement(), {
      id: 2,
      name: 'Biomedical AI',
      code: 'BIOAI',
    });
    expect(session.managingDepartment?.code).toBe('BIOAI');
  });

  it('normalizes a whole payload and tolerates an absent list', () => {
    expect(sessionsFromPlacements([placement()])).toHaveLength(1);
    expect(sessionsFromPlacements(undefined)).toEqual([]);
  });
});

describe('persisted entry normalization', () => {
  it('renders the stored snapshot values and marks the source as persisted', () => {
    const session = sessionFromEntry(scheduleEntry());

    expect(session.source).toBe('PERSISTED');
    expect(session.entryId).toBe(900);
    expect(session.candidateId).toBe('cand-77');
    expect(session.sessionOrdinal).toBe(1);
    expect(session.course.name).toBe('Machine Learning (stored snapshot)');
    expect(session.room?.name).toBe('Artificial Intelligence Lab (stored snapshot)');
    expect(session.instructors[0]?.fullName).toBe('Rana Salim (stored snapshot)');
  });

  it('keeps a stored multi-period entry as one session', () => {
    const session = sessionFromEntry(scheduleEntry());
    expect(session.slots).toHaveLength(2);
    expect(session.startTime).toBe('09:00');
    expect(session.endTime).toBe('11:00');
  });

  it('keeps the group department snapshot', () => {
    const session = sessionFromEntry(scheduleEntry());
    expect(session.studentGroups[0]?.department?.code).toBe('BIOAI');
  });

  it('normalizes a whole entry payload', () => {
    expect(sessionsFromEntries([scheduleEntry()])).toHaveLength(1);
    expect(sessionsFromEntries(undefined)).toEqual([]);
  });
});

describe('session ordering', () => {
  it('orders by the college week, starting on Sunday', () => {
    const sunday = sessionFromEntry(scheduleEntry({ session_id: 'sun', day_of_week: 0, day_display: 'Sunday' }));
    const monday = sessionFromEntry(scheduleEntry({ session_id: 'mon', day_of_week: 1 }));
    const wednesday = sessionFromEntry(scheduleEntry({ session_id: 'wed', day_of_week: 3 }));

    const ordered = sortSessions([wednesday, sunday, monday]);

    expect(ordered.map((session) => session.sessionId)).toEqual(['sun', 'mon', 'wed']);
  });

  it('orders sessions of one day by start time', () => {
    const late = sessionFromEntry(scheduleEntry({ session_id: 'late', start_time: '14:00', end_time: '16:00' }));
    const early = sessionFromEntry(scheduleEntry({ session_id: 'early', start_time: '08:00', end_time: '10:00' }));

    expect(sortSessions([late, early]).map((session) => session.sessionId)).toEqual([
      'early',
      'late',
    ]);
  });
});

describe('presentation filters', () => {
  const sessions = [
    sessionFromEntry(scheduleEntry({ session_id: 'a' })),
    sessionFromEntry(
      scheduleEntry({
        session_id: 'b',
        course: { id: 8, code: 'CS401', name: 'Compilers' },
        room: { id: 23, code: 'CS-201', name: 'Computer Lab' },
        instructors: [{ id: 2, full_name: 'Omar Idris', assignment_role: 'PRIMARY' }],
        student_groups: [{ id: 41, code: 'CS-3', name: 'Computer Science Year 3' }],
        day_of_week: 3,
        day_display: 'Wednesday',
      }),
    ),
  ];

  it('filters by room, course, instructor, group and weekday', () => {
    expect(filterSessions(sessions, { roomId: 23 }).map((s) => s.sessionId)).toEqual(['b']);
    expect(filterSessions(sessions, { courseId: 7 }).map((s) => s.sessionId)).toEqual(['a']);
    expect(filterSessions(sessions, { instructorId: 2 }).map((s) => s.sessionId)).toEqual(['b']);
    expect(filterSessions(sessions, { studentGroupId: 41 }).map((s) => s.sessionId)).toEqual(['b']);
    expect(filterSessions(sessions, { dayOfWeek: 1 }).map((s) => s.sessionId)).toEqual(['a']);
  });

  it('returns everything when no filter is set', () => {
    expect(filterSessions(sessions, {})).toHaveLength(2);
  });

  it('filters by managing department', () => {
    expect(filterSessions(sessions, { departmentId: 2 })).toHaveLength(2);
    expect(filterSessions(sessions, { departmentId: 99 })).toHaveLength(0);
  });
});

describe('filter options', () => {
  it('offers only choices present in the timetable', () => {
    const options = collectFilterOptions(
      [
        sessionFromEntry(scheduleEntry({ session_id: 'a' })),
        sessionFromEntry(scheduleEntry({ session_id: 'b', day_of_week: 3, day_display: 'Wednesday' })),
      ],
      formatDay,
    );

    expect(options.weekdays.map((weekday) => weekday.value)).toEqual([1, 3]);
    expect(options.courses).toHaveLength(1);
    expect(options.rooms).toHaveLength(1);
    expect(options.departments).toHaveLength(1);
  });
});

describe('validation semester passthrough', () => {
  it('keeps the academic year label the backend sent', () => {
    expect(VALIDATION_SEMESTER.academic_year).toBe('2026-2027');
  });
});
