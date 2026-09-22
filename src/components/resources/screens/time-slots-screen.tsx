'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { useCollection } from '@/lib/academic/use-collection';
import { timeSlotsApi, workingDaysApi } from '@/lib/resources/api';
import { SCHEDULER_READ_ONLY_NOTICE } from '@/lib/resources/constants';
import {
  formatMinutes,
  formatTimeRange,
  formatWeekday,
} from '@/lib/resources/formatters';
import { timeSlotFields, timeSlotFormValues, timeSlotPayload } from '@/lib/resources/forms';
import { workingDayOptions } from '@/lib/resources/forms';
import {
  canManageCalendarGrid,
  isSchedulerReadOnly,
} from '@/lib/resources/permissions';
import type { TimeSlot, TimeSlotWrite, WorkingDay } from '@/lib/resources/types';

export function TimeSlotsScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => timeSlotsApi.list({}, signal), []);
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

  /** Working day context for a row whose `working_day` summary has no labels. */
  const workingDayById = useMemo(() => {
    const map = new Map<number, WorkingDay>();
    for (const day of workingDays.items) {
      map.set(day.id, day);
    }
    return map;
  }, [workingDays.items]);

  const columns = useMemo<ColumnSpec<TimeSlot>[]>(
    () => [
      {
        key: 'day',
        header: 'Working day',
        render: (slot) => {
          const day = workingDayById.get(slot.working_day.id);
          return day
            ? `${day.day_of_week_display || formatWeekday(day.day_of_week)} ${formatTimeRange(
                day.start_time,
                day.end_time,
              )}`
            : formatWeekday(slot.working_day.day_of_week);
        },
      },
      {
        key: 'sequence',
        header: 'Sequence',
        render: (slot) => <span className="font-medium">{slot.sequence}</span>,
      },
      {
        key: 'label',
        header: 'Label',
        render: (slot) =>
          slot.label || <span className="text-muted-foreground">Period {slot.sequence}</span>,
      },
      {
        key: 'window',
        header: 'Period',
        render: (slot) => formatTimeRange(slot.start_time, slot.end_time),
      },
      {
        key: 'duration',
        header: 'Duration',
        render: (slot) => formatMinutes(slot.duration_minutes),
      },
      {
        key: 'status',
        header: 'Status',
        render: (slot) => <ActiveStatusBadge isActive={slot.is_active} />,
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
    <AcademicResourcePage<TimeSlot, TimeSlotWrite>
      title="Time Slots"
      description="Teaching periods inside a working day. Durations may vary; a slot must fit inside its day and must not overlap another active slot or break. Duration is derived by the server."
      entityLabel="Time slot"
      entityPlural="time slots"
      load={load}
      columns={columns}
      getRowKey={(slot) => slot.id}
      getRowLabel={(slot) =>
        `${slot.label || `Period ${slot.sequence}`} ${formatTimeRange(slot.start_time, slot.end_time)}`
      }
      searchText={(slot) => `${slot.sequence} ${slot.label} ${slot.start_time}`}
      hasStatus
      getIsActive={(slot) => slot.is_active}
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
      createFields={timeSlotFields(workingDayOptionsList)}
      editFields={() => timeSlotFields(workingDayOptionsList)}
      createFormValues={() => timeSlotFormValues(null)}
      editFormValues={(slot) => timeSlotFormValues(slot)}
      toPayload={timeSlotPayload}
      onCreate={(payload) => timeSlotsApi.create(payload)}
      onUpdate={(id, payload) => timeSlotsApi.update(id, payload)}
      onMutated={workingDays.reload}
      isReferenceLoading={workingDays.status === 'loading'}
    />
  );
}
