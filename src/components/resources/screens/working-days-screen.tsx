'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { semestersApi } from '@/lib/academic/api';
import { semesterOptions } from '@/lib/academic/forms';
import { formatSemester } from '@/lib/academic/formatters';
import type { Semester } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import { workingDaysApi } from '@/lib/resources/api';
import { SCHEDULER_READ_ONLY_NOTICE } from '@/lib/resources/constants';
import { formatTimeRange, formatWeekday } from '@/lib/resources/formatters';
import {
  workingDayFields,
  workingDayFormValues,
  workingDayPayload,
} from '@/lib/resources/forms';
import {
  canManageCalendarGrid,
  isSchedulerReadOnly,
} from '@/lib/resources/permissions';
import type { WorkingDay, WorkingDayWrite } from '@/lib/resources/types';

export function WorkingDaysScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => workingDaysApi.list({}, signal), []);
  const loadSemesters = useCallback((signal: AbortSignal) => semestersApi.list(signal), []);

  const semesters = useCollection<Semester>(loadSemesters);
  const allowed = canManageCalendarGrid(capability);

  const semesterOptionList = useMemo(
    () => semesterOptions(semesters.items),
    [semesters.items],
  );

  const columns = useMemo<ColumnSpec<WorkingDay>[]>(
    () => [
      {
        key: 'semester',
        header: 'Semester',
        render: (day) => formatSemester(day.semester),
      },
      {
        key: 'weekday',
        header: 'Weekday',
        render: (day) => (
          <span className="font-medium">
            {day.day_of_week_display || formatWeekday(day.day_of_week)}
          </span>
        ),
      },
      {
        key: 'code',
        header: 'Weekday code',
        priority: 'secondary',
        render: (day) => day.day_of_week_code ?? '—',
      },
      {
        key: 'window',
        header: 'Opening hours',
        render: (day) => formatTimeRange(day.start_time, day.end_time),
      },
      {
        key: 'status',
        header: 'Status',
        render: (day) => <ActiveStatusBadge isActive={day.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: () => (allowed ? null : <RowAccessBadgeView badge="college-wide" />),
      },
    ],
    [allowed],
  );

  return (
    <AcademicResourcePage<WorkingDay, WorkingDayWrite>
      title="Working Days"
      description="The recurring weekly grid: which weekdays a semester is taught and between which hours. Only configured weekdays are schedulable, and narrowing a window is rejected while active periods or breaks fall outside it."
      entityLabel="Working day"
      entityPlural="working days"
      load={load}
      columns={columns}
      getRowKey={(day) => day.id}
      getRowLabel={(day) =>
        `${formatSemester(day.semester)} ${day.day_of_week_display || formatWeekday(day.day_of_week)}`
      }
      searchText={(day) =>
        `${day.day_of_week_display} ${day.day_of_week_code ?? ''} ${formatSemester(day.semester)}`
      }
      hasStatus
      getIsActive={(day) => day.is_active}
      getRowAccess={(): RowAccess => ({
        manageable: allowed,
        badge: allowed ? null : 'college-wide',
      })}
      createAccess={{
        allowed,
        reason: isSchedulerReadOnly(capability)
          ? SCHEDULER_READ_ONLY_NOTICE
          : 'Only a college administrator can change the college time grid.',
      }}
      createFields={workingDayFields(semesterOptionList)}
      editFields={() => workingDayFields(semesterOptionList)}
      createFormValues={() => workingDayFormValues(null)}
      editFormValues={(day) => workingDayFormValues(day)}
      toPayload={workingDayPayload}
      onCreate={(payload) => workingDaysApi.create(payload)}
      onUpdate={(id, payload) => workingDaysApi.update(id, payload)}
      onMutated={semesters.reload}
      isReferenceLoading={semesters.status === 'loading'}
    />
  );
}
