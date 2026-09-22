'use client';

import { useCallback } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { roomTypesApi } from '@/lib/resources/api';
import { SCHEDULER_READ_ONLY_NOTICE } from '@/lib/resources/constants';
import { roomTypeFields, roomTypeFormValues, roomTypePayload } from '@/lib/resources/forms';
import {
  canManageVocabulary,
  isSchedulerReadOnly,
} from '@/lib/resources/permissions';
import type { RoomType, RoomTypeWrite } from '@/lib/resources/types';

const COLUMNS: ColumnSpec<RoomType>[] = [
  {
    key: 'code',
    header: 'Code',
    render: (roomType) => <span className="font-medium">{roomType.code}</span>,
  },
  { key: 'name', header: 'Name', render: (roomType) => roomType.name },
  {
    key: 'description',
    header: 'Description',
    priority: 'secondary',
    render: (roomType) =>
      roomType.description || <span className="text-muted-foreground">—</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (roomType) => <ActiveStatusBadge isActive={roomType.is_active} />,
  },
];

export function RoomTypesScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => roomTypesApi.list({}, signal), []);
  const allowed = canManageVocabulary(capability);

  return (
    <AcademicResourcePage<RoomType, RoomTypeWrite>
      title="Room Types"
      description="College-wide vocabulary for classifying rooms and laboratories. Only college administrators change it."
      entityLabel="Room type"
      entityPlural="room types"
      load={load}
      columns={COLUMNS}
      getRowKey={(roomType) => roomType.id}
      getRowLabel={(roomType) => `${roomType.code} — ${roomType.name}`}
      searchText={(roomType) => `${roomType.code} ${roomType.name} ${roomType.description}`}
      hasStatus
      getIsActive={(roomType) => roomType.is_active}
      getRowAccess={(): RowAccess => ({
        manageable: allowed,
        badge: allowed ? null : 'college-wide',
      })}
      createAccess={{
        allowed,
        reason: isSchedulerReadOnly(capability)
          ? SCHEDULER_READ_ONLY_NOTICE
          : 'Only a college administrator can change the room type vocabulary.',
      }}
      createFields={roomTypeFields()}
      editFields={() => roomTypeFields()}
      createFormValues={() => roomTypeFormValues(null)}
      editFormValues={(roomType) => roomTypeFormValues(roomType)}
      toPayload={roomTypePayload}
      onCreate={(payload) => roomTypesApi.create(payload)}
      onUpdate={(id, payload) => roomTypesApi.update(id, payload)}
    />
  );
}
