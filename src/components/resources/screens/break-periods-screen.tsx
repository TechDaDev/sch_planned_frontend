'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { useCollection } from '@/lib/academic/use-collection';
import { breakPeriodsApi, workingDaysApi } from '@/lib/resources/api';
import { SCHEDULER_READ_ONLY_NOTICE } from '@/lib/resources/constants';
import { formatTimeRange, formatWeekday } from '@/lib/resources/formatters';
import { workingDayOptions } from '@/lib/resources/forms';
import {
  breakPeriodFields,
  breakPeriodFormValues,
  breakPeriodPayload,
} from '@/lib/resources/forms';
import {
  canManageCalendarGrid,
  isSchedulerReadOnly,
} from '@/lib/resources/permissions';
import type { BreakPeriod, BreakPeriodWrite, WorkingDay } from '@/lib/resources/types';

export function BreakPeriodsScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => breakPeriodsApi.list({}, signal), []);
  const loadWorkingDays = useCallback(
    (signal: AbortSignal) => workingDaysApi.list({}, signal),
    [],
  );

  const workingDays = useCollection<WorkingDay>(loadWorkingDays);
  const allowed = canManageCalendarGrid(capability);

  const workingDayOptionsList = useMemo(
    () => workingDayOptions(workingDays.items),
    [workingDays.items],
  );

  const workingDayById = useMemo(() => {
    const map = new Map<number, WorkingDay>();
    for (const day of workingDays.items) {
      map.set(day.id, day);
    }
    return map;
  }, [workingDays.items]);

  const columns = useMemo<ColumnSpec<BreakPeriod>[]>(
    () => [
      {
        key: 'day',
        header: 'Working day',
        render: (breakPeriod) => {
          const day = workingDayById.get(breakPeriod.working_day.id);
          return day
            ? `${day.day_of_week_display || formatWeekday(day.day_of_week)} ${formatTimeRange(
                day.start_time,
                day.end_time,
              )}`
            : formatWeekday(breakPeriod.working_day.day_of_week);
        },
      },
      {
        key: 'name',
        header: 'Break',
        render: (breakPeriod) => (
          <span className="font-medium">{breakPeriod.name}</span>
        ),
      },
      {
        key: 'window',
        header: 'From–to',
        render: (breakPeriod) =>
          formatTimeRange(breakPeriod.start_time, breakPeriod.end_time),
      },
      {
        key: 'status',
        header: 'Status',
        render: (breakPeriod) => <ActiveStatusBadge isActive={breakPeriod.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: () => (allowed ? null : <RowAccessBadgeView badge="college-wide" />),
      },
    ],
    [allowed, workingDayById],
  );

  return (
    <AcademicResourcePage<BreakPeriod, BreakPeriodWrite>
      title="Breaks"
      description="Explicit breaks inside a working day. A break must fit inside its day and must not overlap an active teaching period or another active break."
      entityLabel="Break"
      entityPlural="breaks"
      load={load}
      columns={columns}
      getRowKey={(breakPeriod) => breakPeriod.id}
      getRowLabel={(breakPeriod) =>
        `${breakPeriod.name} ${formatTimeRange(breakPeriod.start_time, breakPeriod.end_time)}`
      }
      searchText={(breakPeriod) => `${breakPeriod.name} ${breakPeriod.start_time}`}
      hasStatus
      getIsActive={(breakPeriod) => breakPeriod.is_active}
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
      createFields={breakPeriodFields(workingDayOptionsList)}
      editFields={() => breakPeriodFields(workingDayOptionsList)}
      createFormValues={() => breakPeriodFormValues(null)}
      editFormValues={(breakPeriod) => breakPeriodFormValues(breakPeriod)}
      toPayload={breakPeriodPayload}
      onCreate={(payload) => breakPeriodsApi.create(payload)}
      onUpdate={(id, payload) => breakPeriodsApi.update(id, payload)}
      onMutated={workingDays.reload}
      isReferenceLoading={workingDays.status === 'loading'}
    />
  );
}
