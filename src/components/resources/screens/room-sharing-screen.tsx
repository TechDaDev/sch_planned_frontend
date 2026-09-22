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
import { roomAccessApi, roomsApi } from '@/lib/resources/api';
import { SHARING_SCOPE_HELP } from '@/lib/resources/constants';
import type { FormFieldSpec } from '@/lib/resources/forms';
import {
  roomAccessFields,
  roomAccessFormValues,
  roomAccessPayload,
  roomOptions,
} from '@/lib/resources/forms';
import {
  canManageResources,
  canManageRoomSharing,
  isSchedulerReadOnly,
  ownDepartmentId,
} from '@/lib/resources/permissions';
import type {
  Room,
  RoomDepartmentAccess,
  RoomDepartmentAccessWrite,
} from '@/lib/resources/types';

export function RoomSharingScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => roomAccessApi.list({}, signal), []);
  const loadRooms = useCallback((signal: AbortSignal) => roomsApi.list({}, signal), []);
  const loadDepartments = useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );

  const rooms = useCollection<Room>(loadRooms);
  const departments = useCollection<Department>(loadDepartments);

  /** Ownership is resolved from the loaded rooms: the nested summary is shallow. */
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
  const departmentOptionList = useMemo(
    () => departmentOptions(departments.items),
    [departments.items],
  );

  const hasForeignDepartmentOption = departments.items.some(
    (department) => department.id !== own,
  );
  const canCreateGrant = canManageResources(capability) && hasForeignDepartmentOption;

  const resolveField = useCallback(
    (field: FormFieldSpec, values: Record<string, string>): FormFieldSpec => {
      if (field.name !== 'department') {
        return field;
      }
      // The owning department already has access, so it is never a valid target.
      const owner = roomOwner.get(Number(values.room));
      return {
        ...field,
        options: (field.options ?? []).filter(
          (option) => Number(option.value) !== owner,
        ),
      };
    },
    [roomOwner],
  );

  const columns = useMemo<ColumnSpec<RoomDepartmentAccess>[]>(
    () => [
      {
        key: 'room',
        header: 'Room',
        render: (access) => <span className="font-medium">{access.room.code}</span>,
      },
      {
        key: 'name',
        header: 'Room name',
        render: (access) => access.room.name,
      },
      {
        key: 'owner',
        header: 'Owning department',
        render: (access) => {
          const room = rooms.items.find((candidate) => candidate.id === access.room.id);
          return room ? room.owner_department.code : '—';
        },
      },
      {
        key: 'department',
        header: 'Granted to',
        render: (access) => `${access.department.code} — ${access.department.name}`,
      },
      {
        key: 'status',
        header: 'Status',
        render: (access) => <ActiveStatusBadge isActive={access.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (access) =>
          canManageRoomSharing(capability, roomOwner.get(access.room.id) ?? null) ? null : (
            <RowAccessBadgeView badge="external-owner" />
          ),
      },
    ],
    [capability, roomOwner, rooms.items],
  );

  return (
    <AcademicResourcePage<RoomDepartmentAccess, RoomDepartmentAccessWrite>
      title="Room Sharing"
      description={`Grants let another department use a room. Only the owning department manages them. ${SHARING_SCOPE_HELP.SELECTED_DEPARTMENTS}`}
      entityLabel="Sharing grant"
      entityPlural="sharing grants"
      load={load}
      columns={columns}
      getRowKey={(access) => access.id}
      getRowLabel={(access) => `${access.room.code} to ${access.department.code}`}
      searchText={(access) =>
        `${access.room.code} ${access.room.name} ${access.department.code} ${access.department.name}`
      }
      hasStatus
      getIsActive={(access) => access.is_active}
      getRowAccess={(access): RowAccess => {
        const manageable = canManageRoomSharing(
          capability,
          roomOwner.get(access.room.id) ?? null,
        );
        return { manageable, badge: manageable ? null : 'external-owner' };
      }}
      createAccess={{
        allowed: canCreateGrant,
        reason: canCreateGrant
          ? undefined
          : isSchedulerReadOnly(capability)
            ? 'Read-only access: the Scheduler role does not change sharing grants.'
            : 'A grant needs another department as its target. This API only exposes your own department to a department administrator.',
      }}
      createFields={roomAccessFields(roomOptionList, departmentOptionList)}
      editFields={() => roomAccessFields(roomOptionList, departmentOptionList)}
      createFormValues={() => roomAccessFormValues(null)}
      editFormValues={(access) => roomAccessFormValues(access)}
      toPayload={roomAccessPayload}
      onCreate={(payload) => roomAccessApi.create(payload)}
      onUpdate={(id, payload) => roomAccessApi.update(id, payload)}
      resolveField={resolveField}
      onMutated={() => {
        rooms.reload();
        departments.reload();
      }}
      isReferenceLoading={rooms.status === 'loading' || departments.status === 'loading'}
    />
  );
}
