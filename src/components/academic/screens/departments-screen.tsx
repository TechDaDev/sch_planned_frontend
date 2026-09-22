'use client';

import { useCallback } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { collegesApi, departmentsApi } from '@/lib/academic/api';
import {
  collegeOptions,
  departmentFields,
  departmentFormValues,
  departmentPayload,
} from '@/lib/academic/forms';
import { canCreateDepartment, canEditDepartment } from '@/lib/academic/permissions';
import type { College, Department, DepartmentWrite } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';

const COLUMNS: ColumnSpec<Department>[] = [
  {
    key: 'code',
    header: 'Code',
    render: (department) => <span className="font-medium">{department.code}</span>,
  },
  { key: 'name', header: 'Name', render: (department) => department.name },
  {
    key: 'college',
    header: 'College',
    render: (department) =>
      department.college ? (
        `${department.college.code} — ${department.college.name}`
      ) : (
        <span className="text-muted-foreground">Not set</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (department) => <ActiveStatusBadge isActive={department.is_active} />,
  },
];

export function DepartmentsScreen() {
  const { capability, context } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => departmentsApi.list(signal), []);
  const loadColleges = useCallback((signal: AbortSignal) => collegesApi.list(signal), []);
  const colleges = useCollection<College>(loadColleges);

  const allowCreate = canCreateDepartment(capability);

  return (
    <AcademicResourcePage<Department, DepartmentWrite>
      title="Departments"
      description="Departments own study programs, courses and schedules. A department administrator only sees and edits its own department."
      entityLabel="Department"
      entityPlural="departments"
      load={load}
      columns={COLUMNS}
      getRowKey={(department) => department.id}
      getRowLabel={(department) => `${department.code} — ${department.name}`}
      searchText={(department) =>
        `${department.code} ${department.name} ${department.college?.code ?? ''}`
      }
      hasStatus
      getIsActive={(department) => department.is_active}
      getRowAccess={(department): RowAccess => {
        const canEdit = canEditDepartment(capability, department.id);
        return { manageable: canEdit, badge: canEdit ? null : 'read-only' };
      }}
      createAccess={{
        allowed: allowCreate,
        reason: 'Only a college administrator can create departments.',
      }}
      createFields={departmentFields(collegeOptions(colleges.items), context.isCollegeAdmin)}
      editFields={() => departmentFields(collegeOptions(colleges.items), context.isCollegeAdmin)}
      createFormValues={() => departmentFormValues(null)}
      editFormValues={(department) => departmentFormValues(department)}
      // `college` is omitted from the payload when no college is set, which only
      // happens for a legacy row; the form requires it when creating.
      toPayload={(values) => departmentPayload(values) as DepartmentWrite}
      onCreate={(payload) => departmentsApi.create(payload)}
      onUpdate={(id, payload) => departmentsApi.update(id, payload)}
      onMutated={colleges.reload}
      isReferenceLoading={colleges.status === 'loading'}
    />
  );
}
