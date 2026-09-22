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
import { instructorsApi } from '@/lib/resources/api';
import {
  ACCOUNT_LINKING_NOTICE,
  SCHEDULER_READ_ONLY_NOTICE,
  SHARING_SCOPE_HELP,
} from '@/lib/resources/constants';
import { formatSharingScope } from '@/lib/resources/formatters';
import {
  instructorFields,
  instructorFormValues,
  instructorPayload,
} from '@/lib/resources/forms';
import {
  canManageResources,
  isSchedulerReadOnly,
  shareableResourceBadge,
} from '@/lib/resources/permissions';
import type { InstructorProfile, InstructorProfileWrite } from '@/lib/resources/types';

export function InstructorsScreen() {
  const { capability, context } = useAcademicUser();
  const load = useCallback(
    (signal: AbortSignal) => instructorsApi.list({}, signal),
    [],
  );
  const loadDepartments = useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );
  const departments = useCollection<Department>(loadDepartments);

  const departmentOptionList = useMemo(
    () => departmentOptions(departments.items),
    [departments.items],
  );

  const columns = useMemo<ColumnSpec<InstructorProfile>[]>(
    () => [
      {
        key: 'name',
        header: 'Instructor',
        render: (instructor) => (
          <span className="font-medium">{instructor.full_name}</span>
        ),
      },
      {
        key: 'staff_code',
        header: 'Staff code',
        render: (instructor) =>
          instructor.staff_code ?? <span className="text-muted-foreground">—</span>,
      },
      {
        key: 'title',
        header: 'Academic title',
        priority: 'secondary',
        render: (instructor) =>
          instructor.academic_title || <span className="text-muted-foreground">—</span>,
      },
      {
        key: 'department',
        header: 'Primary department',
        render: (instructor) =>
          `${instructor.primary_department.code} — ${instructor.primary_department.name}`,
      },
      {
        key: 'sharing',
        header: 'Sharing',
        render: (instructor) => formatSharingScope(instructor.sharing_scope),
      },
      {
        key: 'limits',
        header: 'Weekly / daily',
        priority: 'secondary',
        render: (instructor) =>
          `${instructor.max_weekly_hours ?? '—'} / ${instructor.max_daily_hours ?? '—'}`,
      },
      {
        key: 'account',
        header: 'Linked account',
        priority: 'secondary',
        render: (instructor) =>
          instructor.user ? (
            instructor.user.username
          ) : (
            <span className="text-muted-foreground">Not linked</span>
          ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (instructor) => <ActiveStatusBadge isActive={instructor.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (instructor) => (
          <RowAccessBadgeView
            badge={shareableResourceBadge(capability, {
              ownerDepartmentId: instructor.primary_department.id,
              sharingScope: instructor.sharing_scope,
            })}
          />
        ),
      },
    ],
    [capability],
  );

  return (
    <AcademicResourcePage<InstructorProfile, InstructorProfileWrite>
      title="Instructor Profiles"
      description={`Instructors are department-owned resources. ${SHARING_SCOPE_HELP.SELECTED_DEPARTMENTS} ${ACCOUNT_LINKING_NOTICE}`}
      entityLabel="Instructor"
      entityPlural="instructors"
      load={load}
      columns={columns}
      getRowKey={(instructor) => instructor.id}
      getRowLabel={(instructor) => instructor.full_name}
      searchText={(instructor) =>
        `${instructor.full_name} ${instructor.staff_code ?? ''} ${instructor.academic_title} ${instructor.primary_department.code}`
      }
      hasStatus
      getIsActive={(instructor) => instructor.is_active}
      getRowAccess={(instructor): RowAccess => {
        const badge = shareableResourceBadge(capability, {
          ownerDepartmentId: instructor.primary_department.id,
          sharingScope: instructor.sharing_scope,
        });
        return { manageable: badge === 'owned', badge };
      }}
      createAccess={{
        allowed: canManageResources(capability),
        reason: isSchedulerReadOnly(capability) ? SCHEDULER_READ_ONLY_NOTICE : undefined,
      }}
      createFields={instructorFields(departmentOptionList, context.isCollegeAdmin)}
      editFields={() => instructorFields(departmentOptionList, context.isCollegeAdmin)}
      createFormValues={() => instructorFormValues(null, context)}
      editFormValues={(instructor) => instructorFormValues(instructor, context)}
      toPayload={instructorPayload}
      onCreate={(payload) => instructorsApi.create(payload)}
      onUpdate={(id, payload) => instructorsApi.update(id, payload)}
      onMutated={departments.reload}
      isReferenceLoading={departments.status === 'loading'}
    />
  );
}
