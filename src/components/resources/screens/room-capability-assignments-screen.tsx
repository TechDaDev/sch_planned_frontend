'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { useCollection } from '@/lib/academic/use-collection';
import { roomCapabilitiesApi, roomCapabilityAssignmentsApi, roomsApi } from '@/lib/resources/api';
import { SCHEDULER_READ_ONLY_NOTICE } from '@/lib/resources/constants';
import { formatDateTime } from '@/lib/academic/formatters';
import {
  roomCapabilityAssignmentFields,
  roomCapabilityAssignmentFormValues,
  roomCapabilityAssignmentPayload,
  roomCapabilityOptions,
  roomOptions,
} from '@/lib/resources/forms';
import {
  canManageResources,
  canManageRoomCapabilityAssignment,
  isSchedulerReadOnly,
  ownDepartmentId,
} from '@/lib/resources/permissions';
import type {
  Room,
  RoomCapability,
  RoomCapabilityAssignment,
  RoomCapabilityAssignmentWrite,
} from '@/lib/resources/types';

export function RoomCapabilityAssignmentsScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback(
    (signal: AbortSignal) => roomCapabilityAssignmentsApi.list({}, signal),
    [],
  );
  const loadRooms = useCallback((signal: AbortSignal) => roomsApi.list({}, signal), []);
  const loadCapabilities = useCallback(
    (signal: AbortSignal) => roomCapabilitiesApi.list({ is_active: true }, signal),
    [],
  );

  const rooms = useCollection<Room>(loadRooms);
  const capabilities = useCollection<RoomCapability>(loadCapabilities);

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
  const capabilityOptionList = useMemo(
    () => roomCapabilityOptions(capabilities.items),
    [capabilities.items],
  );

  const columns = useMemo<ColumnSpec<RoomCapabilityAssignment>[]>(
    () => [
      {
        key: 'room',
        header: 'Room',
        render: (assignment) => (
          <span className="font-medium">{assignment.room.code}</span>
        ),
      },
      {
        key: 'name',
        header: 'Room name',
        render: (assignment) => assignment.room.name,
      },
      {
        key: 'capability',
        header: 'Capability',
        render: (assignment) =>
          `${assignment.capability.code} — ${assignment.capability.name}`,
      },
      {
        key: 'created',
        header: 'Assigned',
        priority: 'secondary',
        render: (assignment) => formatDateTime(assignment.created_at),
      },
      {
        key: 'access',
        header: 'Access',
        render: (assignment) =>
          canManageRoomCapabilityAssignment(
            capability,
            roomOwner.get(assignment.room.id) ?? null,
          ) ? null : (
            <RowAccessBadgeView badge="external-owner" />
          ),
      },
    ],
    [capability, roomOwner],
  );

  return (
    <AcademicResourcePage<RoomCapabilityAssignment, RoomCapabilityAssignmentWrite>
      title="Room Capability Assignments"
      description="Which capabilities a room provides. This link has no active flag and cannot be deleted; edit a row to point it at another room or capability."
      entityLabel="Capability assignment"
      entityPlural="capability assignments"
      load={load}
      columns={columns}
      getRowKey={(assignment) => assignment.id}
      getRowLabel={(assignment) =>
        `${assignment.room.code} — ${assignment.capability.code}`
      }
      searchText={(assignment) =>
        `${assignment.room.code} ${assignment.room.name} ${assignment.capability.code} ${assignment.capability.name}`
      }
      hasStatus={false}
      getRowAccess={(assignment): RowAccess => {
        const manageable = canManageRoomCapabilityAssignment(
          capability,
          roomOwner.get(assignment.room.id) ?? null,
        );
        return { manageable, badge: manageable ? null : 'external-owner' };
      }}
      createAccess={{
        allowed: canManageResources(capability),
        reason: isSchedulerReadOnly(capability) ? SCHEDULER_READ_ONLY_NOTICE : undefined,
      }}
      createFields={roomCapabilityAssignmentFields(roomOptionList, capabilityOptionList)}
      editFields={() =>
        roomCapabilityAssignmentFields(roomOptionList, capabilityOptionList)
      }
      createFormValues={() => roomCapabilityAssignmentFormValues(null)}
      editFormValues={(assignment) => roomCapabilityAssignmentFormValues(assignment)}
      toPayload={roomCapabilityAssignmentPayload}
      onCreate={(payload) => roomCapabilityAssignmentsApi.create(payload)}
      onUpdate={(id, payload) => roomCapabilityAssignmentsApi.update(id, payload)}
      onMutated={() => {
        rooms.reload();
        capabilities.reload();
      }}
      isReferenceLoading={
        rooms.status === 'loading' || capabilities.status === 'loading'
      }
    />
  );
}
