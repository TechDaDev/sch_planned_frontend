'use client';

import { useCallback } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { collegesApi } from '@/lib/academic/api';
import { formatDateTime } from '@/lib/academic/formatters';
import { collegeFields, collegeFormValues, collegePayload } from '@/lib/academic/forms';
import { canManageCollege } from '@/lib/academic/permissions';
import type { College, CollegeWrite } from '@/lib/academic/types';

const COLUMNS: ColumnSpec<College>[] = [
  {
    key: 'code',
    header: 'Code',
    render: (college) => <span className="font-medium">{college.code}</span>,
  },
  { key: 'name', header: 'Name', render: (college) => college.name },
  {
    key: 'status',
    header: 'Status',
    render: (college) => <ActiveStatusBadge isActive={college.is_active} />,
  },
  {
    key: 'updated',
    header: 'Last updated',
    priority: 'secondary',
    render: (college) => formatDateTime(college.updated_at),
  },
];

export function CollegesScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => collegesApi.list(signal), []);
  const allowed = canManageCollege(capability);

  return (
    <AcademicResourcePage<College, CollegeWrite>
      title="Colleges"
      description="The college this deployment serves. Colleges are college-wide records."
      entityLabel="College"
      entityPlural="colleges"
      load={load}
      columns={COLUMNS}
      getRowKey={(college) => college.id}
      getRowLabel={(college) => `${college.code} — ${college.name}`}
      searchText={(college) => `${college.code} ${college.name}`}
      hasStatus
      getIsActive={(college) => college.is_active}
      getRowAccess={(): RowAccess => ({
        manageable: canManageCollege(capability),
        badge: canManageCollege(capability) ? null : 'read-only',
      })}
      createAccess={{
        allowed,
        reason: 'Only a college administrator can create or change colleges.',
      }}
      createFields={collegeFields()}
      editFields={() => collegeFields()}
      createFormValues={() => collegeFormValues(null)}
      editFormValues={(college) => collegeFormValues(college)}
      toPayload={collegePayload}
      onCreate={(payload) => collegesApi.create(payload)}
      onUpdate={(id, payload) => collegesApi.update(id, payload)}
    />
  );
}
