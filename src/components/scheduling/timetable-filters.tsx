'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { formatDay } from '@/lib/scheduling/formatters';
import {
  collectFilterOptions,
  type TimetableFilter,
} from '@/lib/scheduling/normalization';
import type { TimetableSession } from '@/lib/scheduling/types';

export interface TimetableFiltersProps {
  sessions: readonly TimetableSession[];
  filter: TimetableFilter;
  onChange: (filter: TimetableFilter) => void;
  /** Department filtering is pointless when every session shares one department. */
  showDepartment?: boolean;
}

const ALL = '';

function toNumber(value: string): number | null {
  return value === ALL ? null : Number(value);
}

const selectClassName =
  'h-10 w-full rounded-md border border-line bg-surface px-2 text-sm';

/**
 * Client-side presentation filters.
 *
 * The filter choices are derived from the timetable itself, so no option is
 * offered that would return nothing. The preview endpoints accept no filters and
 * a stored version is immutable, so filtering here changes the display only.
 */
export function TimetableFilters({
  sessions,
  filter,
  onChange,
  showDepartment = false,
}: TimetableFiltersProps) {
  const options = React.useMemo(
    () => collectFilterOptions(sessions, formatDay),
    [sessions],
  );

  const hasAny =
    options.courses.length > 1 ||
    options.instructors.length > 1 ||
    options.studentGroups.length > 1 ||
    options.rooms.length > 1 ||
    options.weekdays.length > 1 ||
    (showDepartment && options.departments.length > 1);

  const activeCount = Object.values(filter).filter(
    (value) => value !== null && value !== undefined,
  ).length;

  if (!hasAny) {
    return null;
  }

  return (
    <section aria-label="Timetable filters" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {showDepartment && options.departments.length > 1 ? (
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Department
            </span>
            <select
              className={selectClassName}
              value={filter.departmentId == null ? ALL : String(filter.departmentId)}
              onChange={(event) =>
                onChange({ ...filter, departmentId: toNumber(event.target.value) })
              }
            >
              <option value={ALL}>All departments</option>
              {options.departments.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {options.courses.length > 1 ? (
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Course
            </span>
            <select
              className={selectClassName}
              value={filter.courseId == null ? ALL : String(filter.courseId)}
              onChange={(event) =>
                onChange({ ...filter, courseId: toNumber(event.target.value) })
              }
            >
              <option value={ALL}>All courses</option>
              {options.courses.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {options.instructors.length > 1 ? (
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Instructor
            </span>
            <select
              className={selectClassName}
              value={filter.instructorId == null ? ALL : String(filter.instructorId)}
              onChange={(event) =>
                onChange({ ...filter, instructorId: toNumber(event.target.value) })
              }
            >
              <option value={ALL}>All instructors</option>
              {options.instructors.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {options.studentGroups.length > 1 ? (
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Student group
            </span>
            <select
              className={selectClassName}
              value={filter.studentGroupId == null ? ALL : String(filter.studentGroupId)}
              onChange={(event) =>
                onChange({ ...filter, studentGroupId: toNumber(event.target.value) })
              }
            >
              <option value={ALL}>All student groups</option>
              {options.studentGroups.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {options.rooms.length > 1 ? (
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Room</span>
            <select
              className={selectClassName}
              value={filter.roomId == null ? ALL : String(filter.roomId)}
              onChange={(event) =>
                onChange({ ...filter, roomId: toNumber(event.target.value) })
              }
            >
              <option value={ALL}>All rooms</option>
              {options.rooms.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {options.weekdays.length > 1 ? (
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Weekday
            </span>
            <select
              className={selectClassName}
              value={filter.dayOfWeek == null ? ALL : String(filter.dayOfWeek)}
              onChange={(event) =>
                onChange({ ...filter, dayOfWeek: toNumber(event.target.value) })
              }
            >
              <option value={ALL}>All weekdays</option>
              {options.weekdays.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {activeCount > 0 ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            onChange({
              departmentId: null,
              courseId: null,
              instructorId: null,
              studentGroupId: null,
              roomId: null,
              dayOfWeek: null,
            })
          }
        >
          Clear filters ({activeCount})
        </Button>
      ) : null}
    </section>
  );
}
