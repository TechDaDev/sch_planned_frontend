'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { departmentsApi } from '@/lib/academic/api';
import { departmentOptions } from '@/lib/academic/forms';
import type { Department } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import { roomTypesApi, roomsApi } from '@/lib/resources/api';
import {
  SCHEDULER_READ_ONLY_NOTICE,
  SHARING_SCOPE_HELP,
} from '@/lib/resources/constants';
import { formatSharingScope } from '@/lib/resources/formatters';
import { roomFields, roomFormValues, roomPayload, roomTypeOptions } from '@/lib/resources/forms';
import {
  canManageResources,
  isSchedulerReadOnly,
  shareableResourceBadge,
} from '@/lib/resources/permissions';
import type { Room, RoomType, RoomWrite } from '@/lib/resources/types';

export function RoomsScreen() {
  const { capability, context } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => roomsApi.list({}, signal), []);
  const loadDepartments = useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );
  const loadRoomTypes = useCallback(
    (signal: AbortSignal) => roomTypesApi.list({ is_active: true }, signal),
    [],
  );

  const departments = useCollection<Department>(loadDepartments);
  const roomTypes = useCollection<RoomType>(loadRoomTypes);

  const departmentOptionList = useMemo(
    () => departmentOptions(departments.items),
    [departments.items],
  );
  const roomTypeOptionList = useMemo(
    () => roomTypeOptions(roomTypes.items),
    [roomTypes.items],
  );

  const columns = useMemo<ColumnSpec<Room>[]>(
    () => [
      {
        key: 'code',
        header: 'Code',
        render: (room) => <span className="font-medium">{room.code}</span>,
      },
      { key: 'name', header: 'Name', render: (room) => room.name },
      {
        key: 'department',
        header: 'Owning department',
        render: (room) =>
          `${room.owner_department.code} — ${room.owner_department.name}`,
      },
      {
        key: 'type',
        header: 'Room type',
        render: (room) => `${room.room_type.code} — ${room.room_type.name}`,
      },
      {
        key: 'capacity',
        header: 'Capacity',
        render: (room) => String(room.capacity),
      },
      {
        key: 'sharing',
        header: 'Sharing',
        render: (room) => formatSharingScope(room.sharing_scope),
      },
      {
        key: 'status',
        header: 'Status',
        render: (room) => <ActiveStatusBadge isActive={room.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (room) => (
          <RowAccessBadgeView
            badge={shareableResourceBadge(capability, {
              ownerDepartmentId: room.owner_department.id,
              sharingScope: room.sharing_scope,
            })}
          />
        ),
      },
    ],
    [capability],
  );

  return (
    <AcademicResourcePage<Room, RoomWrite>
      title="Rooms"
      description={`Rooms are department-owned. ${SHARING_SCOPE_HELP.SELECTED_DEPARTMENTS}`}
      entityLabel="Room"
      entityPlural="rooms"
      load={load}
      columns={columns}
      getRowKey={(room) => room.id}
      getRowLabel={(room) => `${room.code} — ${room.name}`}
      searchText={(room) =>
        `${room.code} ${room.name} ${room.owner_department.code} ${room.room_type.code}`
      }
      hasStatus
      getIsActive={(room) => room.is_active}
      getRowAccess={(room): RowAccess => {
        const badge = shareableResourceBadge(capability, {
          ownerDepartmentId: room.owner_department.id,
          sharingScope: room.sharing_scope,
        });
        return { manageable: badge === 'owned', badge };
      }}
      createAccess={{
        allowed: canManageResources(capability),
        reason: isSchedulerReadOnly(capability) ? SCHEDULER_READ_ONLY_NOTICE : undefined,
      }}
      createFields={roomFields(
        departmentOptionList,
        roomTypeOptionList,
        context.isCollegeAdmin,
      )}
      editFields={() =>
        roomFields(departmentOptionList, roomTypeOptionList, context.isCollegeAdmin)
      }
      createFormValues={() => roomFormValues(null, context)}
      editFormValues={(room) => roomFormValues(room, context)}
      toPayload={roomPayload}
      onCreate={(payload) => roomsApi.create(payload)}
      onUpdate={(id, payload) => roomsApi.update(id, payload)}
      onMutated={() => {
        departments.reload();
        roomTypes.reload();
      }}
      isReferenceLoading={
        departments.status === 'loading' || roomTypes.status === 'loading'
      }
    />
  );
}
