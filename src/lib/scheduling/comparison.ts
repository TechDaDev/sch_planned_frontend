/**
 * Version-to-version comparison.
 *
 * Only two versions of the **same** logical schedule may be compared: the
 * sessions of one schedule are the scheduling identities that pairing relies on,
 * and a department's timetable has nothing meaningful to say about another
 * department's.
 *
 * Pairing is done on `session_id`, the scheduling identity of a session. A
 * session present only in one version is reported as `ADDED` or `REMOVED`
 * instead of being dropped, because a regenerated version may legitimately cover
 * a different academic structure.
 *
 * Comparison reads each version's own snapshot labels. A live course, room,
 * instructor, group or department name is never loaded to compare two stored
 * versions.
 */

import type {
  SessionChange,
  SessionChangeKind,
  TimetableComparison,
  TimetableSession,
} from '@/lib/scheduling/types';
import { toMinutes } from '@/lib/scheduling/normalization';

/** Occupied-slot fingerprint without the room, used to isolate a time change. */
function timeKey(session: TimetableSession): string {
  const slots = session.slots
    .map((slot) => `${slot.sequence}@${slot.startTime}-${slot.endTime}`)
    .join('|');
  return `${session.dayOfWeek}#${session.startTime}-${session.endTime}#${slots}`;
}

function roomKey(session: TimetableSession): string {
  return session.room ? `${session.room.id}` : 'none';
}

/**
 * Stored content fingerprint.
 *
 * `candidate_id` is deliberately absent: two runs can pick a different candidate
 * for the same physical placement without anything a user can see changing.
 */
function contentKey(session: TimetableSession): string {
  const instructors = session.instructors
    .map((instructor) => `${instructor.id}:${instructor.fullName}:${instructor.assignmentRole ?? ''}`)
    .sort()
    .join('|');
  const groups = session.studentGroups
    .map((group) => `${group.id}:${group.code}:${group.name}`)
    .sort()
    .join('|');
  return [
    `${session.course.id}:${session.course.code}:${session.course.name}`,
    `${session.offering.id}:${session.offering.offering_code}`,
    `${session.teachingComponent.id}:${session.teachingComponent.component_type}:${session.teachingComponent.label ?? ''}`,
    session.managingDepartment ? String(session.managingDepartment.id) : 'none',
    instructors,
    groups,
  ].join('~');
}

/**
 * Classify one session present in both versions.
 *
 * Time, room, penalty and stored content are separated so the label states what
 * actually changed instead of collapsing every difference into "content". A
 * penalty-only difference means the solver scored the same placement differently,
 * which is not a physical change.
 */
export function classifyChange(
  before: TimetableSession,
  after: TimetableSession,
): SessionChangeKind {
  const timeChanged = timeKey(before) !== timeKey(after);
  const roomChanged = roomKey(before) !== roomKey(after);
  if (timeChanged && roomChanged) {
    return 'TIME_AND_ROOM_CHANGED';
  }
  if (timeChanged) {
    return 'TIME_CHANGED';
  }
  if (roomChanged) {
    return 'ROOM_CHANGED';
  }
  if (contentKey(before) !== contentKey(after)) {
    return 'CONTENT_CHANGED';
  }
  if (before.penalty !== after.penalty) {
    return 'PENALTY_CHANGED';
  }
  return 'UNCHANGED';
}

export class ScheduleComparisonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleComparisonError';
  }
}

/**
 * Compare two versions of one schedule.
 *
 * `scheduleA` and `scheduleB` are the logical schedules the versions belong to.
 * Calling this with two different schedules is a programming error: the UI only
 * ever offers versions of a single schedule's history.
 */
export function compareSessions(
  before: readonly TimetableSession[],
  after: readonly TimetableSession[],
  options: { scheduleA?: number | null; scheduleB?: number | null } = {},
): TimetableComparison {
  const { scheduleA, scheduleB } = options;
  if (
    scheduleA !== undefined &&
    scheduleB !== undefined &&
    scheduleA !== null &&
    scheduleB !== null &&
    scheduleA !== scheduleB
  ) {
    throw new ScheduleComparisonError(
      'Only two versions of the same schedule can be compared.',
    );
  }

  const beforeById = new Map<string, TimetableSession>();
  for (const session of before) {
    beforeById.set(session.sessionId, session);
  }
  const afterById = new Map<string, TimetableSession>();
  for (const session of after) {
    afterById.set(session.sessionId, session);
  }

  const changes: SessionChange[] = [];
  let unchangedCount = 0;

  for (const [sessionId, baseSession] of beforeById) {
    const nextSession = afterById.get(sessionId);
    if (nextSession === undefined) {
      changes.push({
        sessionId,
        kind: 'REMOVED',
        before: baseSession,
        after: null,
      });
      continue;
    }
    const kind = classifyChange(baseSession, nextSession);
    if (kind === 'UNCHANGED') {
      unchangedCount += 1;
      continue;
    }
    changes.push({ sessionId, kind, before: baseSession, after: nextSession });
  }

  for (const [sessionId, nextSession] of afterById) {
    if (!beforeById.has(sessionId)) {
      changes.push({ sessionId, kind: 'ADDED', before: null, after: nextSession });
    }
  }

  const order: Record<SessionChangeKind, number> = {
    ADDED: 0,
    REMOVED: 1,
    TIME_AND_ROOM_CHANGED: 2,
    TIME_CHANGED: 3,
    ROOM_CHANGED: 4,
    CONTENT_CHANGED: 5,
    PENALTY_CHANGED: 6,
    UNCHANGED: 7,
  };

  changes.sort((left, right) => {
    const byKind = order[left.kind] - order[right.kind];
    if (byKind !== 0) {
      return byKind;
    }
    const leftDay = (left.after ?? left.before)?.dayOfWeek ?? 0;
    const rightDay = (right.after ?? right.before)?.dayOfWeek ?? 0;
    if (leftDay !== rightDay) {
      return leftDay - rightDay;
    }
    const leftStart = toMinutes((left.after ?? left.before)?.startTime);
    const rightStart = toMinutes((right.after ?? right.before)?.startTime);
    if (leftStart !== rightStart) {
      return (leftStart ?? 0) - (rightStart ?? 0);
    }
    return left.sessionId.localeCompare(right.sessionId);
  });

  return {
    changes,
    unchangedCount,
    changedCount: changes.length,
    addedCount: changes.filter((change) => change.kind === 'ADDED').length,
    removedCount: changes.filter((change) => change.kind === 'REMOVED').length,
  };
}
