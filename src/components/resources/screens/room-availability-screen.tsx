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
import { roomAvailabilityApi, roomsApi } from '@/lib/resources/api';
import { SCHEDULER_READ_ONLY_NOTICE } from '@/lib/resources/constants';
import { formatTimeRange, formatWeekday } from '@/lib/resources/formatters';
import {
  roomAvailabilityFields,
  roomAvailabilityFormValues,
  roomAvailabilityPayload,
  roomOptions,
} from '@/lib/resources/forms';
import {
  canManageResources,
  canManageRoomAvailability,
  isSchedulerReadOnly,
  ownDepartmentId,
} from '@/lib/resources/permissions';
import type {
  Room,
  RoomAvailability,
  RoomAvailabilityWrite,
} from '@/lib/resources/types';

export function RoomAvailabilityScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => roomAvailabilityApi.list({}, signal), []);
  const loadRooms = useCallback((signal: AbortSignal) => roomsApi.list({}, signal), []);
  const loadSemesters = useCallback((signal: AbortSignal) => semestersApi.list(signal), []);

  const rooms = useCollection<Room>(loadRooms);
  const semesters = useCollection<Semester>(loadSemesters);

  const roomOwner = useMemo(() => {
    const map = new Map<number, number>();
    for (const room of rooms.items) {
      map.set(room.id, room.owner_department.id);
    }
    return map;
  }, [rooms.items]);

  const own = ownDepartmentId(capability);
  const ownRooms = useMemo(
    () => rooms.items.filter((room) => room.owner_department.id === own),
    [rooms.items, own],
  );

  const roomOptionList = useMemo(() => roomOptions(ownRooms), [ownRooms]);
  const semesterOptionList = useMemo(
    () => semesterOptions(semesters.items),
    [semesters.items],
  );

  const columns = useMemo<ColumnSpec<RoomAvailability>[]>(
    () => [
      {
        key: 'room',
        header: 'Room',
        render: (window) => <span className="font-medium">{window.room.code}</span>,
      },
      {
        key: 'name',
        header: 'Room name',
        render: (window) => window.room.name,
      },
      {
        key: 'semester',
        header: 'Semester',
        render: (window) => formatSemester(window.semester),
      },
      {
        key: 'day',
        header: 'Weekday',
        render: (window) =>
          window.day_of_week_display || formatWeekday(window.day_of_week),
      },
      {
        key: 'window',
        header: 'Available',
        render: (window) => formatTimeRange(window.start_time, window.end_time),
      },
      {
        key: 'status',
        header: 'Status',
        render: (window) => <ActiveStatusBadge isActive={window.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (window) =>
          canManageRoomAvailability(capability, roomOwner.get(window.room.id) ?? null) ? null : (
            <RowAccessBadgeView badge="external-owner" />
          ),
      },
    ],
    [capability, roomOwner],
  );

  return (
    <AcademicResourcePage<RoomAvailability, RoomAvailabilityWrite>
      title="Room Availability"
      description="Recurring weekly availability of a room. No row for a weekday means availability is not configured there, never that the room is open all day."
      entityLabel="Availability window"
      entityPlural="availability windows"
      load={load}
      columns={columns}
      getRowKey={(window) => window.id}
      getRowLabel={(window) =>
        `${window.room.code} ${window.day_of_week_display} ${formatTimeRange(
          window.start_time,
          window.end_time,
        )}`
      }
      searchText={(window) =>
        `${window.room.code} ${window.room.name} ${window.day_of_week_display} ${formatSemester(
          window.semester,
        )}`
      }
      hasStatus
      getIsActive={(window) => window.is_active}
      getRowAccess={(window): RowAccess => {
        const manageable = canManageRoomAvailability(
          capability,
          roomOwner.get(window.room.id) ?? null,
        );
        return { manageable, badge: manageable ? null : 'external-owner' };
      }}
      createAccess={{
        allowed: canManageResources(capability),
        reason: isSchedulerReadOnly(capability) ? SCHEDULER_READ_ONLY_NOTICE : undefined,
      }}
      createFields={roomAvailabilityFields(roomOptionList, semesterOptionList)}
      editFields={() => roomAvailabilityFields(roomOptionList, semesterOptionList)}
      createFormValues={() => roomAvailabilityFormValues(null)}
      editFormValues={(window) => roomAvailabilityFormValues(window)}
      toPayload={roomAvailabilityPayload}
      onCreate={(payload) => roomAvailabilityApi.create(payload)}
      onUpdate={(id, payload) => roomAvailabilityApi.update(id, payload)}
      onMutated={() => {
        rooms.reload();
        semesters.reload();
      }}
      isReferenceLoading={rooms.status === 'loading' || semesters.status === 'loading'}
    />
  );
}
