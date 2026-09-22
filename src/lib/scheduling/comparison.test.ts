import { describe, expect, it } from 'vitest';

import {
  classifyChange,
  compareSessions,
  ScheduleComparisonError,
} from '@/lib/scheduling/comparison';
import { sessionFromEntry } from '@/lib/scheduling/normalization';
import type { ScheduleEntry } from '@/lib/scheduling/types';
import { scheduleEntry } from '@/test/scheduling-fixtures';

/** A session built from the entry fixture, with the fields a test changes. */
function session(overrides: Partial<ScheduleEntry>) {
  return sessionFromEntry(scheduleEntry(overrides));
}

const BASE = session({ session_id: 'tc-10#s1' });

describe('classification of one session', () => {
  it('reports an identical session as unchanged', () => {
    expect(classifyChange(BASE, session({ session_id: 'tc-10#s1' }))).toBe('UNCHANGED');
  });

  it('reports a moved session as a time change', () => {
    const moved = session({
      session_id: 'tc-10#s1',
      day_of_week: 2,
      day_display: 'Tuesday',
      start_time: '11:00',
      end_time: '13:00',
    });
    expect(classifyChange(BASE, moved)).toBe('TIME_CHANGED');
  });

  it('reports a different room as a room change', () => {
    const moved = session({
      session_id: 'tc-10#s1',
      room: { id: 23, code: 'CS-201', name: 'Computer Lab' },
    });
    expect(classifyChange(BASE, moved)).toBe('ROOM_CHANGED');
  });

  it('reports both at once as a combined change', () => {
    const moved = session({
      session_id: 'tc-10#s1',
      day_of_week: 2,
      day_display: 'Tuesday',
      start_time: '11:00',
      end_time: '13:00',
      room: { id: 23, code: 'CS-201', name: 'Computer Lab' },
    });
    expect(classifyChange(BASE, moved)).toBe('TIME_AND_ROOM_CHANGED');
  });

  it('reports a changed snapshot label as a content change', () => {
    const renamed = session({
      session_id: 'tc-10#s1',
      course: { id: 7, code: 'ML301', name: 'Machine Learning II' },
    });
    expect(classifyChange(BASE, renamed)).toBe('CONTENT_CHANGED');
  });

  it('reports a changed instructor set as a content change', () => {
    const reassigned = session({
      session_id: 'tc-10#s1',
      instructors: [{ id: 2, full_name: 'Omar Idris', assignment_role: 'PRIMARY' }],
    });
    expect(classifyChange(BASE, reassigned)).toBe('CONTENT_CHANGED');
  });

  it('reports a changed student group as a content change', () => {
    const regrouped = session({
      session_id: 'tc-10#s1',
      student_groups: [{ id: 41, code: 'CS-3', name: 'Computer Science Year 3' }],
    });
    expect(classifyChange(BASE, regrouped)).toBe('CONTENT_CHANGED');
  });

  it('reports a changed managing department as a content change', () => {
    const moved = session({
      session_id: 'tc-10#s1',
      managing_department: { id: 99, name: 'Computer Science', code: 'CS' },
    });
    expect(classifyChange(BASE, moved)).toBe('CONTENT_CHANGED');
  });

  it('reports a penalty-only difference as a penalty change', () => {
    const rescored = session({ session_id: 'tc-10#s1', penalty: 9 });
    expect(classifyChange(BASE, rescored)).toBe('PENALTY_CHANGED');
  });

  it('does not treat a different candidate id as a physical change', () => {
    const otherCandidate = session({ session_id: 'tc-10#s1', candidate_id: 'cand-99' });
    expect(classifyChange(BASE, otherCandidate)).toBe('UNCHANGED');
  });

  it('does not treat the stored row id as a physical change', () => {
    const otherRow = session({ session_id: 'tc-10#s1', id: 1234 });
    expect(classifyChange(BASE, otherRow)).toBe('UNCHANGED');
  });
});

describe('comparing two versions', () => {
  it('reports an identical pair as fully unchanged', () => {
    const comparison = compareSessions([BASE], [session({ session_id: 'tc-10#s1' })]);

    expect(comparison.changedCount).toBe(0);
    expect(comparison.unchangedCount).toBe(1);
    expect(comparison.addedCount).toBe(0);
    expect(comparison.removedCount).toBe(0);
    expect(comparison.changes).toEqual([]);
  });

  it('pairs sessions on session_id, not on position', () => {
    const first = session({ session_id: 'c' });
    const second = session({ session_id: 'a' });
    const comparison = compareSessions([first, second], [second, first]);

    expect(comparison.changedCount).toBe(0);
    expect(comparison.unchangedCount).toBe(2);
  });

  it('reports a session only in the newer version as added', () => {
    const comparison = compareSessions([], [session({ session_id: 'new' })]);

    expect(comparison.addedCount).toBe(1);
    expect(comparison.changes[0]?.kind).toBe('ADDED');
    expect(comparison.changes[0]?.before).toBeNull();
    expect(comparison.changes[0]?.after?.sessionId).toBe('new');
  });

  it('reports a session only in the older version as removed', () => {
    const comparison = compareSessions([session({ session_id: 'gone' })], []);

    expect(comparison.removedCount).toBe(1);
    expect(comparison.changes[0]?.kind).toBe('REMOVED');
    expect(comparison.changes[0]?.after).toBeNull();
  });

  it('survives versions with different session sets', () => {
    const comparison = compareSessions(
      [session({ session_id: 'keep' }), session({ session_id: 'gone' })],
      [session({ session_id: 'keep' }), session({ session_id: 'fresh' })],
    );

    expect(comparison.unchangedCount).toBe(1);
    expect(comparison.addedCount).toBe(1);
    expect(comparison.removedCount).toBe(1);
    expect(comparison.changedCount).toBe(2);
  });

  it('orders added and removed sessions before changed ones', () => {
    const comparison = compareSessions(
      [session({ session_id: 'a' }), session({ session_id: 'b' })],
      [
        session({ session_id: 'a', room: { id: 23, code: 'CS-201', name: 'Computer Lab' } }),
        session({ session_id: 'c' }),
      ],
    );

    expect(comparison.changes.map((change) => change.kind)).toEqual([
      'ADDED',
      'REMOVED',
      'ROOM_CHANGED',
    ]);
  });

  it('compares each version against its own snapshot labels', () => {
    const older = session({
      session_id: 'tc-10#s1',
      course: { id: 7, code: 'ML301', name: 'Machine Learning (2026 name)' },
    });
    const newer = session({
      session_id: 'tc-10#s1',
      course: { id: 7, code: 'ML301', name: 'Machine Learning (2027 name)' },
    });

    const comparison = compareSessions([older], [newer]);

    expect(comparison.changes[0]?.kind).toBe('CONTENT_CHANGED');
    expect(comparison.changes[0]?.before?.course.name).toBe('Machine Learning (2026 name)');
    expect(comparison.changes[0]?.after?.course.name).toBe('Machine Learning (2027 name)');
  });

  it('refuses to compare two different schedules', () => {
    expect(() =>
      compareSessions([BASE], [BASE], { scheduleA: 300, scheduleB: 301 }),
    ).toThrow(ScheduleComparisonError);
  });

  it('accepts two versions of one schedule', () => {
    expect(() =>
      compareSessions([BASE], [BASE], { scheduleA: 300, scheduleB: 300 }),
    ).not.toThrow();
  });
});
