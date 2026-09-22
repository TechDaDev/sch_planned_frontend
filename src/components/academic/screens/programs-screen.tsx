'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { departmentsApi, programsApi } from '@/lib/academic/api';
import { formatStudyType } from '@/lib/academic/formatters';
import {
  departmentOptions,
  programFields,
  programFormValues,
  programPayload,
} from '@/lib/academic/forms';
import {
  canAccessAcademicModule,
  canManageDepartmentOwnedResource,
} from '@/lib/academic/permissions';
import type {
  Department,
  StudyProgram,
  StudyProgramWrite,
} from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';

const COLUMNS: ColumnSpec<StudyProgram>[] = [
  {
    key: 'code',
    header: 'Code',
    render: (program) => <span className="font-medium">{program.code}</span>,
  },
  { key: 'name', header: 'Name', render: (program) => program.name },
  {
    key: 'type',
    header: 'Study type',
    render: (program) => formatStudyType(program.study_type),
  },
  {
    key: 'department',
    header: 'Department',
    render: (program) => `${program.department.code} — ${program.department.name}`,
  },
  {
    key: 'status',
    header: 'Status',
    render: (program) => <ActiveStatusBadge isActive={program.is_active} />,
  },
];

export function ProgramsScreen() {
  const { capability, context } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => programsApi.list(signal), []);
  const loadDepartments = useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );
  const departments = useCollection<Department>(loadDepartments);

  const departmentOptionsForForm = useMemo(
    () => departmentOptions(departments.items),
    [departments.items],
  );

  return (
    <AcademicResourcePage<StudyProgram, StudyProgramWrite>
      title="Study Programs"
      description="Programs offered by a department, at undergraduate, master's or PhD level."
      entityLabel="Study program"
      entityPlural="study programs"
      load={load}
      columns={COLUMNS}
      getRowKey={(program) => program.id}
      getRowLabel={(program) => `${program.code} — ${program.name}`}
      searchText={(program) =>
        `${program.code} ${program.name} ${program.department.code} ${formatStudyType(program.study_type)}`
      }
      hasStatus
      getIsActive={(program) => program.is_active}
      getRowAccess={(program): RowAccess => {
        const canEdit = canManageDepartmentOwnedResource(capability, program.department.id);
        return { manageable: canEdit, badge: canEdit ? null : 'read-only' };
      }}
      createAccess={{ allowed: canAccessAcademicModule(capability) }}
      createFields={programFields(departmentOptionsForForm, context.isCollegeAdmin)}
      editFields={() => programFields(departmentOptionsForForm, context.isCollegeAdmin)}
      createFormValues={() => programFormValues(null, context)}
      editFormValues={(program) => programFormValues(program, context)}
      toPayload={programPayload}
      onCreate={(payload) => programsApi.create(payload)}
      onUpdate={(id, payload) => programsApi.update(id, payload)}
      onMutated={departments.reload}
      isReferenceLoading={departments.status === 'loading'}
    />
  );
}
