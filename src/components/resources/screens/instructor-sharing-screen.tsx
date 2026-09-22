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
import { instructorAccessApi, instructorsApi } from '@/lib/resources/api';
import { SHARING_SCOPE_HELP } from '@/lib/resources/constants';
import type { FormFieldSpec } from '@/lib/resources/forms';
import {
  instructorAccessFields,
  instructorAccessFormValues,
  instructorAccessPayload,
  instructorOptions,
} from '@/lib/resources/forms';
import {
  canManageInstructorSharing,
  canManageResources,
  isSchedulerReadOnly,
  ownDepartmentId,
} from '@/lib/resources/permissions';
import type {
  InstructorDepartmentAccess,
  InstructorDepartmentAccessWrite,
  InstructorProfile,
} from '@/lib/resources/types';

export function InstructorSharingScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback(
    (signal: AbortSignal) => instructorAccessApi.list({}, signal),
    [],
  );
  const loadInstructors = useCallback(
    (signal: AbortSignal) => instructorsApi.list({}, signal),
    [],
  );
  const loadDepartments = useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );

  const instructors = useCollection<InstructorProfile>(loadInstructors);
  const departments = useCollection<Department>(loadDepartments);

  /**
   * A grant is owned by the instructor's primary department, but the nested
   * instructor summary carries no department, so ownership is resolved from the
   * loaded instructor collection.
   */
  const instructorDepartment = useMemo(() => {
    const map = new Map<number, number>();
    for (const instructor of instructors.items) {
      map.set(instructor.id, instructor.primary_department.id);
    }
    return map;
  }, [instructors.items]);

  const ownInstructors = useMemo(() => {
    const own = ownDepartmentId(capability);
    return instructors.items.filter(
      (instructor) => instructor.primary_department.id === own,
    );
  }, [instructors.items, capability]);

  const instructorOptionList = useMemo(
    () => instructorOptions(ownInstructors),
    [ownInstructors],
  );

  const departmentOptionList = useMemo(
    () => departmentOptions(departments.items),
    [departments.items],
  );

  /**
   * Creating a grant needs the identity of another department.
   *
   * A department administrator only ever sees its own department through this
   * API, so the form could not offer a valid target; the action is withheld with
   * an explanation instead of failing on submit.
   */
  const own = ownDepartmentId(capability);
  const hasForeignDepartmentOption = departments.items.some(
    (department) => department.id !== own,
  );
  const canCreateGrant = canManageResources(capability) && hasForeignDepartmentOption;

  const resolveField = useCallback(
    (field: FormFieldSpec, values: Record<string, string>): FormFieldSpec => {
      if (field.name !== 'department') {
        return field;
      }
      // The primary department already has inherent access, so it is never a
      // valid grant target.
      const primaryDepartment = instructorDepartment.get(Number(values.instructor));
      return {
        ...field,
        options: (field.options ?? []).filter(
          (option) => Number(option.value) !== primaryDepartment,
        ),
      };
    },
    [instructorDepartment],
  );

  const columns = useMemo<ColumnSpec<InstructorDepartmentAccess>[]>(
    () => [
      {
        key: 'instructor',
        header: 'Instructor',
        render: (access) => (
          <span className="font-medium">{access.instructor.full_name}</span>
        ),
      },
      {
        key: 'owner',
        header: 'Owning department',
        render: (access) => {
          const owner = instructorDepartment.get(access.instructor.id);
          const instructor = instructors.items.find(
            (candidate) => candidate.id === access.instructor.id,
          );
          return instructor
            ? `${instructor.primary_department.code}`
            : owner === undefined
              ? '—'
              : `#${owner}`;
        },
      },
      {
        key: 'department',
        header: 'Granted to',
        render: (access) =>
          `${access.department.code} — ${access.department.name}`,
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
          canManageInstructorSharing(
            capability,
            instructorDepartment.get(access.instructor.id) ?? null,
          ) ? null : (
            <RowAccessBadgeView badge="external-owner" />
          ),
      },
    ],
    [capability, instructorDepartment, instructors.items],
  );

  return (
    <AcademicResourcePage<InstructorDepartmentAccess, InstructorDepartmentAccessWrite>
      title="Instructor Sharing"
      description={`Grants let another department schedule an instructor. Only the instructor's primary department manages them. ${SHARING_SCOPE_HELP.PRIVATE}`}
      entityLabel="Sharing grant"
      entityPlural="sharing grants"
      load={load}
      columns={columns}
      getRowKey={(access) => access.id}
      getRowLabel={(access) =>
        `${access.instructor.full_name} to ${access.department.code}`
      }
      searchText={(access) =>
        `${access.instructor.full_name} ${access.department.code} ${access.department.name}`
      }
      hasStatus
      getIsActive={(access) => access.is_active}
      getRowAccess={(access): RowAccess => {
        const manageable = canManageInstructorSharing(
          capability,
          instructorDepartment.get(access.instructor.id) ?? null,
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
      createFields={instructorAccessFields(instructorOptionList, departmentOptionList)}
      editFields={() =>
        instructorAccessFields(instructorOptionList, departmentOptionList)
      }
      createFormValues={() => instructorAccessFormValues(null)}
      editFormValues={(access) => instructorAccessFormValues(access)}
      toPayload={instructorAccessPayload}
      onCreate={(payload) => instructorAccessApi.create(payload)}
      onUpdate={(id, payload) => instructorAccessApi.update(id, payload)}
      resolveField={resolveField}
      onMutated={() => {
        instructors.reload();
        departments.reload();
      }}
      isReferenceLoading={
        instructors.status === 'loading' || departments.status === 'loading'
      }
    />
  );
}
