'use client';

import { useCallback } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { roomCapabilitiesApi } from '@/lib/resources/api';
import { SCHEDULER_READ_ONLY_NOTICE } from '@/lib/resources/constants';
import {
  roomCapabilityFields,
  roomCapabilityFormValues,
  roomCapabilityPayload,
} from '@/lib/resources/forms';
import {
  canManageVocabulary,
  isSchedulerReadOnly,
} from '@/lib/resources/permissions';
import type { RoomCapability, RoomCapabilityWrite } from '@/lib/resources/types';

const COLUMNS: ColumnSpec<RoomCapability>[] = [
  {
    key: 'code',
    header: 'Code',
    render: (capability) => <span className="font-medium">{capability.code}</span>,
  },
  { key: 'name', header: 'Name', render: (capability) => capability.name },
  {
    key: 'description',
    header: 'Description',
    priority: 'secondary',
    render: (capability) =>
      capability.description || <span className="text-muted-foreground">—</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (capability) => <ActiveStatusBadge isActive={capability.is_active} />,
  },
];

export function RoomCapabilitiesScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback(
    (signal: AbortSignal) => roomCapabilitiesApi.list({}, signal),
    [],
  );
  const allowed = canManageVocabulary(capability);

  return (
    <AcademicResourcePage<RoomCapability, RoomCapabilityWrite>
      title="Room Capabilities"
      description="College-wide vocabulary for room equipment and features. Only college administrators change it."
      entityLabel="Room capability"
      entityPlural="room capabilities"
      load={load}
      columns={COLUMNS}
      getRowKey={(row) => row.id}
      getRowLabel={(row) => `${row.code} — ${row.name}`}
      searchText={(row) => `${row.code} ${row.name} ${row.description}`}
      hasStatus
      getIsActive={(row) => row.is_active}
      getRowAccess={(): RowAccess => ({
        manageable: allowed,
        badge: allowed ? null : 'college-wide',
      })}
      createAccess={{
        allowed,
        reason: isSchedulerReadOnly(capability)
          ? SCHEDULER_READ_ONLY_NOTICE
          : 'Only a college administrator can change the room capability vocabulary.',
      }}
      createFields={roomCapabilityFields()}
      editFields={() => roomCapabilityFields()}
      createFormValues={() => roomCapabilityFormValues(null)}
      editFormValues={(row) => roomCapabilityFormValues(row)}
      toPayload={roomCapabilityPayload}
      onCreate={(payload) => roomCapabilitiesApi.create(payload)}
      onUpdate={(id, payload) => roomCapabilitiesApi.update(id, payload)}
    />
  );
}
