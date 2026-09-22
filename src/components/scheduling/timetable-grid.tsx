'use client';

import * as React from 'react';

import { formatInstructorList, formatRoom, formatTimeRange, toClockTime } from '@/lib/scheduling/formatters';
import { toMinutes } from '@/lib/scheduling/normalization';
import type { TimetableSession } from '@/lib/scheduling/types';

export interface TimetableGridProps {
  sessions: readonly TimetableSession[];
  /** Weekday labels in college-week order; defaults to Sunday–Thursday. */
  weekdays?: readonly { value: number; label: string }[];
  /** Pixel height of one hour, used as the geometric scale. */
  hourHeight?: number;
  /** Show the managing department on each event (college timetables). */
  showDepartment?: boolean;
  className?: string;
}

const DEFAULT_WEEKDAYS: readonly { value: number; label: string }[] = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
];

interface Window {
  startMinute: number;
  endMinute: number;
  totalMinutes: number;
}

/**
 * Time window of a timetable.
 *
 * The window comes from the sessions' own start and end times, so periods of
 * different lengths are drawn at their real size. A period is never assumed to be
 * one hour.
 */
function computeWindow(sessions: readonly TimetableSession[]): Window | null {
  const starts: number[] = [];
  const ends: number[] = [];
  for (const session of sessions) {
    const start = toMinutes(session.startTime);
    const end = toMinutes(session.endTime);
    if (start !== null) {
      starts.push(start);
    }
    if (end !== null) {
      ends.push(end);
    }
  }
  if (starts.length === 0 || ends.length === 0) {
    return null;
  }
  const first = Math.min(...starts);
  const last = Math.max(...ends);
  const startMinute = Math.floor(first / 60) * 60;
  const endMinute = Math.max(Math.ceil(last / 60) * 60, startMinute + 60);
  return { startMinute, endMinute, totalMinutes: endMinute - startMinute };
}

function sessionTitle(session: TimetableSession): string {
  return `${session.course.code} — ${session.course.name}, ${session.dayDisplay}, ${formatTimeRange(
    session.startTime,
    session.endTime,
  )}, ${formatRoom(session.room)}`;
}

interface EventBlockProps {
  session: TimetableSession;
  window: Window;
  hourHeight: number;
  showDepartment: boolean;
}

function EventBlock({ session, window, hourHeight, showDepartment }: EventBlockProps) {
  const start = toMinutes(session.startTime);
  const end = toMinutes(session.endTime);
  if (start === null || end === null) {
    return null;
  }
  const top = ((start - window.startMinute) / 60) * hourHeight;
  const height = Math.max(((end - start) / 60) * hourHeight, 28);

  return (
    <li
      className="absolute inset-x-1 rounded-md border border-line bg-surface-muted px-2 py-1 text-xs"
      style={{ top, height }}
      data-session-id={session.sessionId}
    >
      <article aria-label={sessionTitle(session)} className="h-full overflow-hidden">
        <p className="font-medium">
          {session.course.code}
          <span className="font-normal text-muted-foreground"> — {session.course.name}</span>
        </p>
        <p className="text-muted-foreground">
          {session.teachingComponent.component_type}
          {session.teachingComponent.label ? ` (${session.teachingComponent.label})` : ''}
        </p>
        <p className="text-muted-foreground">
          {formatTimeRange(session.startTime, session.endTime)}
        </p>
        <p className="text-muted-foreground">{formatRoom(session.room)}</p>
        <p className="text-muted-foreground">
          {formatInstructorList(session.instructors)}
        </p>
        <p className="text-muted-foreground">
          {session.studentGroups.map((group) => group.code).join(', ') || 'No student group'}
        </p>
        {showDepartment && session.managingDepartment ? (
          <p className="text-muted-foreground">{session.managingDepartment.code}</p>
        ) : null}
      </article>
    </li>
  );
}

/**
 * Weekly timetable grid.
 *
 * The week starts on Sunday because that is the college week the backend sends;
 * browser calendar conventions are never assumed. Each session is one entry in a
 * day list, positioned by its real start and end times, so a multi-period session
 * is drawn once and spans its whole interval.
 *
 * A grid alone is never the only representation: `TimetableView` also renders the
 * same sessions as an accessible list.
 */
export function TimetableGrid({
  sessions,
  weekdays = DEFAULT_WEEKDAYS,
  hourHeight = 56,
  showDepartment = false,
  className,
}: TimetableGridProps) {
  const window = React.useMemo(() => computeWindow(sessions), [sessions]);

  const hourMarks = React.useMemo(() => {
    if (!window) {
      return [];
    }
    const marks: number[] = [];
    for (let minute = window.startMinute; minute <= window.endMinute; minute += 60) {
      marks.push(minute);
    }
    return marks;
  }, [window]);

  if (!window) {
    return (
      <p className={className}>No session to display in the grid.</p>
    );
  }

  const gridHeight = (window.totalMinutes / 60) * hourHeight;
  const columns = `4.5rem repeat(${weekdays.length}, minmax(11rem, 1fr))`;

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <div className="min-w-[56rem]">
          <div className="grid border-b border-line" style={{ gridTemplateColumns: columns }}>
            <div aria-hidden="true" />
            {weekdays.map((day) => (
              <div
                key={day.value}
                role="columnheader"
                className="px-2 py-2 text-sm font-medium"
              >
                {day.label}
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: columns }}>
            <div className="relative" style={{ height: gridHeight }} aria-hidden="true">
              {hourMarks.map((minute) => (
                <div
                  key={minute}
                  className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground"
                  style={{ top: ((minute - window.startMinute) / 60) * hourHeight }}
                >
                  {`${String(Math.floor(minute / 60)).padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            {weekdays.map((day) => {
              const daySessions = sessions.filter((session) => session.dayOfWeek === day.value);
              return (
                <section
                  key={day.value}
                  aria-label={`${day.label} sessions`}
                  className="relative border-l border-line"
                  style={{ height: gridHeight }}
                >
                  {hourMarks
                    .filter((minute) => minute !== window.startMinute)
                    .map((minute) => (
                      <div
                        key={minute}
                        aria-hidden="true"
                        className="absolute inset-x-0 border-t border-line/60"
                        style={{ top: ((minute - window.startMinute) / 60) * hourHeight }}
                      />
                    ))}
                  <ol className="absolute inset-0 m-0 list-none p-0">
                    {daySessions.map((session) => (
                      <EventBlock
                        key={session.sessionId}
                        session={session}
                        window={window}
                        hourHeight={hourHeight}
                        showDepartment={showDepartment}
                      />
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Exported for the list view and tests: the same day scale, in text. */
export { DEFAULT_WEEKDAYS, computeWindow, toClockTime };
