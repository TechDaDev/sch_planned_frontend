'use client';

import * as React from 'react';

import { TimetableFilters } from '@/components/scheduling/timetable-filters';
import { TimetableGrid } from '@/components/scheduling/timetable-grid';
import { TimetableList } from '@/components/scheduling/timetable-list';
import { Button } from '@/components/ui/button';
import { filterSessions, sortSessions, type TimetableFilter } from '@/lib/scheduling/normalization';
import type { TimetableSession } from '@/lib/scheduling/types';

export type TimetableViewMode = 'grid' | 'list';

export interface TimetableViewProps {
  sessions: readonly TimetableSession[];
  /** Defaults to the grid; the accessible list is one click away. */
  defaultMode?: TimetableViewMode;
  showDepartment?: boolean;
  emptyMessage?: string;
}

const EMPTY_FILTER: TimetableFilter = {
  departmentId: null,
  courseId: null,
  instructorId: null,
  studentGroupId: null,
  roomId: null,
  dayOfWeek: null,
};

/**
 * Timetable visualization with a grid/list switch.
 *
 * Both representations render the same normalized sessions, so the accessible
 * list is never a reduced version of the grid. Nothing here is draggable and no
 * session can be moved: validated manual editing is a separate form-first screen
 * (`/scheduling/versions/[id]/edit`).
 */
export function TimetableView({
  sessions,
  defaultMode = 'grid',
  showDepartment = false,
  emptyMessage = 'No session in this timetable.',
}: TimetableViewProps) {
  const [mode, setMode] = React.useState<TimetableViewMode>(defaultMode);
  const [filter, setFilter] = React.useState<TimetableFilter>(EMPTY_FILTER);

  const ordered = React.useMemo(() => sortSessions(sessions), [sessions]);
  const visible = React.useMemo(() => filterSessions(ordered, filter), [ordered, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Timetable representation" className="flex gap-1">
          <Button
            size="sm"
            variant={mode === 'grid' ? 'secondary' : 'ghost'}
            aria-pressed={mode === 'grid'}
            onClick={() => setMode('grid')}
          >
            Grid
          </Button>
          <Button
            size="sm"
            variant={mode === 'list' ? 'secondary' : 'ghost'}
            aria-pressed={mode === 'list'}
            onClick={() => setMode('list')}
          >
            List
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {visible.length} of {ordered.length} session{ordered.length === 1 ? '' : 's'} shown
        </p>
      </div>

      <TimetableFilters
        sessions={ordered}
        filter={filter}
        onChange={setFilter}
        showDepartment={showDepartment}
      />

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No session matches the selected filters.
        </p>
      ) : mode === 'grid' ? (
        <TimetableGrid sessions={visible} showDepartment={showDepartment} />
      ) : (
        <TimetableList sessions={visible} showDepartment={showDepartment} />
      )}
    </div>
  );
}
