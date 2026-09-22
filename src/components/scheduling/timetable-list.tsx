'use client';

import type { ColumnSpec } from '@/components/academic/data-table';
import { DataTable } from '@/components/academic/data-table';
import { formatDay, formatRoom, formatTimeRange } from '@/lib/scheduling/formatters';
import type { TimetableSession } from '@/lib/scheduling/types';

export interface TimetableListProps {
  sessions: readonly TimetableSession[];
  /** Show the managing department column (college timetables). */
  showDepartment?: boolean;
}

const columns: ColumnSpec<TimetableSession>[] = [
  {
    key: 'day',
    header: 'Day',
    render: (session) => session.dayDisplay || formatDay(session.dayOfWeek),
  },
  {
    key: 'time',
    header: 'Time',
    render: (session) => formatTimeRange(session.startTime, session.endTime),
  },
  {
    key: 'course',
    header: 'Course',
    render: (session) => (
      <span>
        <span className="font-medium">{session.course.code}</span> — {session.course.name}
      </span>
    ),
  },
  {
    key: 'component',
    header: 'Component',
    render: (session) =>
      session.teachingComponent.label
        ? `${session.teachingComponent.component_type} (${session.teachingComponent.label})`
        : session.teachingComponent.component_type,
  },
  {
    key: 'room',
    header: 'Room',
    render: (session) => formatRoom(session.room),
  },
  {
    key: 'instructors',
    header: 'Instructors',
    priority: 'secondary',
    render: (session) =>
      session.instructors.length === 0
        ? 'No instructor assigned'
        : session.instructors.map((instructor) => instructor.fullName).join(', '),
  },
  {
    key: 'groups',
    header: 'Student groups',
    priority: 'secondary',
    render: (session) =>
      session.studentGroups.length === 0
        ? 'No student group'
        : session.studentGroups.map((group) => group.code).join(', '),
  },
];

const departmentColumn: ColumnSpec<TimetableSession> = {
  key: 'department',
  header: 'Managing department',
  priority: 'secondary',
  render: (session) => session.managingDepartment?.code ?? '—',
};

/**
 * Accessible timetable representation.
 *
 * A session's position on the grid is neither the only nor the primary way to
 * understand the timetable: day, time, room, course, instructors and groups are
 * all stated as text here, so assistive technology and narrow screens get the
 * same information as the visual grid.
 */
export function TimetableList({ sessions, showDepartment = false }: TimetableListProps) {
  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">No session to display.</p>;
  }

  const columnSpecs = showDepartment
    ? [...columns.slice(0, 5), departmentColumn, ...columns.slice(5)]
    : columns;

  return (
    <DataTable
      caption="Timetable sessions"
      columns={columnSpecs}
      items={sessions}
      getRowKey={(session) => session.sessionId}
    />
  );
}
