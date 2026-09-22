'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import {
  courseOfferingsApi,
  programsApi,
  stagesApi,
  studentGroupsApi,
  teachingComponentGroupsApi,
  teachingComponentsApi,
} from '@/lib/academic/api';
import {
  componentGroupFields,
  componentGroupFormValues,
  componentGroupPayload,
  studentGroupOptions,
  teachingComponentOptions,
} from '@/lib/academic/forms';
import { formatComponentType } from '@/lib/academic/formatters';
import {
  canAccessAcademicModule,
  canManageComponentGroup,
  componentGroupRowBadge,
} from '@/lib/academic/permissions';
import type {
  CourseOffering,
  StudentGroup,
  StudyProgram,
  StudyStage,
  TeachingComponent,
  TeachingComponentGroup,
  TeachingComponentGroupWrite,
} from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';

export function ComponentGroupsScreen() {
  const { capability, context } = useAcademicUser();

  const load = useCallback(
    (signal: AbortSignal) => teachingComponentGroupsApi.list(signal),
    [],
  );
  const loadComponents = useCallback(
    (signal: AbortSignal) => teachingComponentsApi.list(signal),
    [],
  );
  const loadOfferings = useCallback(
    (signal: AbortSignal) => courseOfferingsApi.list(signal),
    [],
  );
  const loadGroups = useCallback((signal: AbortSignal) => studentGroupsApi.list(signal), []);
  const loadStages = useCallback((signal: AbortSignal) => stagesApi.list(signal), []);
  const loadPrograms = useCallback((signal: AbortSignal) => programsApi.list(signal), []);

  const components = useCollection<TeachingComponent>(loadComponents);
  const offerings = useCollection<CourseOffering>(loadOfferings);
  const groups = useCollection<StudentGroup>(loadGroups);
  const stages = useCollection<StudyStage>(loadStages);
  const programs = useCollection<StudyProgram>(loadPrograms);

  /**
   * Neither a teaching component nor a student group carries its owning
   * department in the nested summaries, so department ownership is resolved from
   * the already-loaded collections instead of being guessed.
   */
  const ownership = useMemo(() => {
    const offeringDepartment = new Map<number, number>();
    for (const offering of offerings.items) {
      offeringDepartment.set(offering.id, offering.managing_department.id);
    }
    const componentDepartment = new Map<number, number | null>();
    for (const component of components.items) {
      componentDepartment.set(
        component.id,
        offeringDepartment.get(component.offering.id) ?? null,
      );
    }
    const programDepartment = new Map<number, number>();
    for (const program of programs.items) {
      programDepartment.set(program.id, program.department.id);
    }
    const stageDepartment = new Map<number, number | null>();
    for (const stage of stages.items) {
      stageDepartment.set(stage.id, programDepartment.get(stage.program.id) ?? null);
    }
    const groupDepartment = new Map<number, number | null>();
    for (const group of groups.items) {
      groupDepartment.set(group.id, stageDepartment.get(group.stage.id) ?? null);
    }
    return { componentDepartment, groupDepartment };
  }, [components.items, offerings.items, groups.items, stages.items, programs.items]);

  const componentOptionList = useMemo(
    () =>
      teachingComponentOptions(
        context.isCollegeAdmin
          ? components.items
          : components.items.filter(
              (component) =>
                ownership.componentDepartment.get(component.id) ===
                context.ownDepartmentId,
            ),
      ),
    [components.items, context.isCollegeAdmin, context.ownDepartmentId, ownership],
  );

  const groupOptionList = useMemo(
    () =>
      studentGroupOptions(
        context.isCollegeAdmin
          ? groups.items
          : groups.items.filter(
              (group) => ownership.groupDepartment.get(group.id) === context.ownDepartmentId,
            ),
      ),
    [groups.items, context.isCollegeAdmin, context.ownDepartmentId, ownership],
  );

  const componentDepartmentOf = useCallback(
    (link: TeachingComponentGroup): number | null =>
      ownership.componentDepartment.get(link.teaching_component.id) ?? null,
    [ownership],
  );

  const groupDepartmentOf = useCallback(
    (link: TeachingComponentGroup): number | null =>
      ownership.groupDepartment.get(link.student_group.id) ?? null,
    [ownership],
  );

  const columns = useMemo<ColumnSpec<TeachingComponentGroup>[]>(
    () => [
      {
        key: 'component',
        header: 'Teaching component',
        render: (link) => {
          const component = components.items.find(
            (candidate) => candidate.id === link.teaching_component.id,
          );
          const type = formatComponentType(link.teaching_component.component_type);
          const label = link.teaching_component.label
            ? ` (${link.teaching_component.label})`
            : '';
          return component ? (
            <span className="font-medium">
              {component.offering.course.code} — {type}
              {label}
            </span>
          ) : (
            <span className="font-medium">
              {type}
              {label}
            </span>
          );
        },
      },
      {
        key: 'offering',
        header: 'Offering',
        render: (link) => {
          const component = components.items.find(
            (candidate) => candidate.id === link.teaching_component.id,
          );
          const offering = component
            ? offerings.items.find((candidate) => candidate.id === component.offering.id)
            : undefined;
          return offering
            ? `${offering.course.code} [${offering.offering_code}]`
            : (component?.offering.offering_code ?? '—');
        },
      },
      {
        key: 'group',
        header: 'Student group',
        render: (link) => `${link.student_group.code} — ${link.student_group.name}`,
      },
      {
        key: 'access',
        header: 'Access',
        render: (link) => {
          const badge = componentGroupRowBadge(
            capability,
            componentDepartmentOf(link),
            groupDepartmentOf(link),
          );
          return badge ? <RowAccessBadgeView badge={badge} /> : null;
        },
      },
    ],
    [
      capability,
      components.items,
      offerings.items,
      componentDepartmentOf,
      groupDepartmentOf,
    ],
  );

  return (
    <AcademicResourcePage<TeachingComponentGroup, TeachingComponentGroupWrite>
      title="Component Groups"
      description="Which student groups attend each teaching component, including combined lectures and joint inter-department teaching."
      entityLabel="Component group link"
      entityPlural="component group links"
      load={load}
      columns={columns}
      getRowKey={(link) => link.id}
      getRowLabel={(link) =>
        `${link.teaching_component.label || link.teaching_component.component_type} → ${
          link.student_group.code
        }`
      }
      searchText={(link) => {
        const component = components.items.find(
          (candidate) => candidate.id === link.teaching_component.id,
        );
        return `${component?.offering.course.code ?? ''} ${component?.offering.course.name ?? ''} ${
          link.teaching_component.label
        } ${link.student_group.code} ${link.student_group.name}`;
      }}
      hasStatus={false}
      getRowAccess={(link): RowAccess => {
        const groupDepartmentId = groupDepartmentOf(link);
        return {
          manageable: canManageComponentGroup(
            capability,
            componentDepartmentOf(link),
            groupDepartmentId,
          ),
          badge: componentGroupRowBadge(
            capability,
            componentDepartmentOf(link),
            groupDepartmentId,
          ),
        };
      }}
      createAccess={{ allowed: canAccessAcademicModule(capability) }}
      createFields={componentGroupFields(
        componentOptionList,
        groupOptionList,
        context.isCollegeAdmin,
      )}
      editFields={() =>
        componentGroupFields(componentOptionList, groupOptionList, context.isCollegeAdmin)
      }
      createFormValues={() => componentGroupFormValues(null)}
      editFormValues={(link) => componentGroupFormValues(link)}
      toPayload={componentGroupPayload}
      onCreate={(payload) => teachingComponentGroupsApi.create(payload)}
      onUpdate={(id, payload) => teachingComponentGroupsApi.update(id, payload)}
      onMutated={() => {
        components.reload();
        offerings.reload();
        groups.reload();
        stages.reload();
        programs.reload();
      }}
      isReferenceLoading={
        components.status === 'loading' ||
        offerings.status === 'loading' ||
        groups.status === 'loading' ||
        stages.status === 'loading' ||
        programs.status === 'loading'
      }
    />
  );
}
