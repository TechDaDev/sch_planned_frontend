'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { programsApi, stagesApi, studentGroupsApi } from '@/lib/academic/api';
import type { FormFieldSpec } from '@/lib/academic/forms';
import {
  parentGroupOptionsFor,
  stageOptions,
  studentGroupFields,
  studentGroupFormValues,
  studentGroupPayload,
} from '@/lib/academic/forms';
import {
  canAccessAcademicModule,
  canManageDepartmentOwnedResource,
} from '@/lib/academic/permissions';
import type {
  StudentGroup,
  StudentGroupWrite,
  StudyProgram,
  StudyStage,
} from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';

/**
 * Group rows.
 *
 * A subgroup is indented so the hierarchy is readable without a tree editor, and
 * its parent is always shown in its own column.
 */
const COLUMNS: ColumnSpec<StudentGroup>[] = [
  {
    key: 'group',
    header: 'Group',
    render: (group) => (
      <span className="font-medium">
        {group.parent_group ? (
          <>
            <span aria-hidden="true">↳ </span>
            <span className="sr-only">Subgroup of {group.parent_group.code}. </span>
          </>
        ) : null}
        {group.code} — {group.name}
      </span>
    ),
  },
  {
    key: 'stage',
    header: 'Stage',
    render: (group) => `${group.stage.name} (stage ${group.stage.number})`,
  },
  {
    key: 'parent',
    header: 'Parent group',
    render: (group) =>
      group.parent_group ? (
        `${group.parent_group.code} — ${group.parent_group.name}`
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: 'students',
    header: 'Students',
    render: (group) => String(group.student_count),
  },
  {
    key: 'status',
    header: 'Status',
    render: (group) => <ActiveStatusBadge isActive={group.is_active} />,
  },
];

export function StudentGroupsScreen() {
  const { capability, context } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => studentGroupsApi.list(signal), []);
  const loadStages = useCallback((signal: AbortSignal) => stagesApi.list(signal), []);
  const loadPrograms = useCallback((signal: AbortSignal) => programsApi.list(signal), []);

  const stages = useCollection<StudyStage>(loadStages);
  const programs = useCollection<StudyProgram>(loadPrograms);

  const stageDepartment = useMemo(() => {
    const programDepartment = new Map<number, number>();
    for (const program of programs.items) {
      programDepartment.set(program.id, program.department.id);
    }
    const departmentOfStage = new Map<number, number | null>();
    for (const stage of stages.items) {
      departmentOfStage.set(stage.id, programDepartment.get(stage.program.id) ?? null);
    }
    return departmentOfStage;
  }, [programs.items, stages.items]);

  const allowedStages = useMemo(
    () =>
      context.isCollegeAdmin
        ? stages.items
        : stages.items.filter(
            (stage) => stageDepartment.get(stage.id) === context.ownDepartmentId,
          ),
    [stages.items, stageDepartment, context.isCollegeAdmin, context.ownDepartmentId],
  );

  const stageOptionList = useMemo(() => stageOptions(allowedStages), [allowedStages]);

  /**
   * Parent-group choices follow the selected stage and exclude the group being
   * edited. The recursive hierarchy rules stay on the backend, whose errors are
   * displayed verbatim.
   */
  const resolveField = useCallback(
    (
      field: FormFieldSpec,
      values: Record<string, string>,
      options: { items: readonly StudentGroup[]; editingItem: StudentGroup | null },
    ): FormFieldSpec => {
      if (field.name !== 'parent_group') {
        return field;
      }
      return {
        ...field,
        options: parentGroupOptionsFor(
          options.items,
          values,
          options.editingItem?.id ?? null,
        ),
      };
    },
    [],
  );

  return (
    <AcademicResourcePage<StudentGroup, StudentGroupWrite>
      title="Student Groups"
      description="Groups inside a stage, with optional practical subgroups. A subgroup must belong to the same stage as its parent group."
      entityLabel="Student group"
      entityPlural="student groups"
      load={load}
      columns={COLUMNS}
      getRowKey={(group) => group.id}
      getRowLabel={(group) => `${group.code} — ${group.name}`}
      searchText={(group) => `${group.code} ${group.name} ${group.stage.name}`}
      hasStatus
      getIsActive={(group) => group.is_active}
      getRowAccess={(group): RowAccess => {
        const canEdit = canManageDepartmentOwnedResource(
          capability,
          stageDepartment.get(group.stage.id) ?? null,
        );
        return { manageable: canEdit, badge: canEdit ? null : 'read-only' };
      }}
      createAccess={{ allowed: canAccessAcademicModule(capability) }}
      createFields={studentGroupFields(stageOptionList, [])}
      editFields={() => studentGroupFields(stageOptionList, [])}
      createFormValues={() => studentGroupFormValues(null)}
      editFormValues={(group) => studentGroupFormValues(group)}
      toPayload={studentGroupPayload}
      onCreate={(payload) => studentGroupsApi.create(payload)}
      onUpdate={(id, payload) => studentGroupsApi.update(id, payload)}
      onMutated={() => {
        stages.reload();
        programs.reload();
      }}
      resolveField={resolveField}
      isReferenceLoading={stages.status === 'loading' || programs.status === 'loading'}
    />
  );
}
