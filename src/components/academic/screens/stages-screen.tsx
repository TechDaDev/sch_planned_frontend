'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { programsApi, stagesApi } from '@/lib/academic/api';
import { formatStudyType } from '@/lib/academic/formatters';
import { programOptions, stageFields, stageFormValues, stagePayload } from '@/lib/academic/forms';
import {
  canAccessAcademicModule,
  canManageDepartmentOwnedResource,
} from '@/lib/academic/permissions';
import type { StudyProgram, StudyStage, StudyStageWrite } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';

const COLUMNS: ColumnSpec<StudyStage>[] = [
  {
    key: 'number',
    header: 'Stage',
    render: (stage) => <span className="font-medium">Stage {stage.number}</span>,
  },
  { key: 'name', header: 'Name', render: (stage) => stage.name },
  {
    key: 'program',
    header: 'Study program',
    render: (stage) => `${stage.program.code} — ${stage.program.name}`,
  },
  {
    key: 'type',
    header: 'Study type',
    priority: 'secondary',
    render: (stage) => formatStudyType(stage.program.study_type),
  },
  {
    key: 'status',
    header: 'Status',
    render: (stage) => <ActiveStatusBadge isActive={stage.is_active} />,
  },
];

export function StagesScreen() {
  const { capability, context } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => stagesApi.list(signal), []);
  const loadPrograms = useCallback((signal: AbortSignal) => programsApi.list(signal), []);
  const programs = useCollection<StudyProgram>(loadPrograms);

  /**
   * A stage's owning department is only reachable through its program, so the
   * program collection resolves both the capability check and the form options.
   */
  const programDepartment = useMemo(() => {
    const map = new Map<number, number>();
    for (const program of programs.items) {
      map.set(program.id, program.department.id);
    }
    return map;
  }, [programs.items]);

  const allowedPrograms = useMemo(
    () =>
      context.isCollegeAdmin
        ? programs.items
        : programs.items.filter(
            (program) => program.department.id === context.ownDepartmentId,
          ),
    [programs.items, context.isCollegeAdmin, context.ownDepartmentId],
  );

  return (
    <AcademicResourcePage<StudyStage, StudyStageWrite>
      title="Study Stages"
      description="The numbered stages inside each study program."
      entityLabel="Study stage"
      entityPlural="study stages"
      load={load}
      columns={COLUMNS}
      getRowKey={(stage) => stage.id}
      getRowLabel={(stage) => `Stage ${stage.number} — ${stage.name}`}
      searchText={(stage) =>
        `${stage.number} ${stage.name} ${stage.program.code} ${stage.program.name}`
      }
      hasStatus
      getIsActive={(stage) => stage.is_active}
      getRowAccess={(stage): RowAccess => {
        const departmentId = programDepartment.get(stage.program.id) ?? null;
        const canEdit = canManageDepartmentOwnedResource(capability, departmentId);
        return { manageable: canEdit, badge: canEdit ? null : 'read-only' };
      }}
      createAccess={{ allowed: canAccessAcademicModule(capability) }}
      createFields={stageFields(programOptions(allowedPrograms))}
      editFields={() => stageFields(programOptions(allowedPrograms))}
      createFormValues={() => stageFormValues(null)}
      editFormValues={(stage) => stageFormValues(stage)}
      toPayload={stagePayload}
      onCreate={(payload) => stagesApi.create(payload)}
      onUpdate={(id, payload) => stagesApi.update(id, payload)}
      onMutated={programs.reload}
      isReferenceLoading={programs.status === 'loading'}
    />
  );
}
