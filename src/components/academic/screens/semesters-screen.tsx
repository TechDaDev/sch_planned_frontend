'use client';

import { useCallback } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { academicYearsApi, semestersApi } from '@/lib/academic/api';
import { formatDate } from '@/lib/academic/formatters';
import { academicYearOptions, semesterFields, semesterFormValues, semesterPayload } from '@/lib/academic/forms';
import { canManageSemester, hasCrossDepartmentAccess } from '@/lib/academic/permissions';
import type { AcademicYear, Semester, SemesterWrite } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';

const COLUMNS: ColumnSpec<Semester>[] = [
  {
    key: 'year',
    header: 'Academic year',
    render: (semester) =>
      `${semester.academic_year.start_year}–${semester.academic_year.end_year}`,
  },
  {
    key: 'number',
    header: 'Semester',
    render: (semester) => (semester.number === 1 ? 'First' : 'Second'),
  },
  {
    key: 'start_date',
    header: 'Start date',
    priority: 'secondary',
    render: (semester) => formatDate(semester.start_date),
  },
  {
    key: 'end_date',
    header: 'End date',
    priority: 'secondary',
    render: (semester) => formatDate(semester.end_date),
  },
  {
    key: 'status',
    header: 'Status',
    render: (semester) => <ActiveStatusBadge isActive={semester.is_active} />,
  },
];

export function SemestersScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => semestersApi.list(signal), []);
  const loadYears = useCallback((signal: AbortSignal) => academicYearsApi.list(signal), []);
  const years = useCollection<AcademicYear>(loadYears);

  const allowed = canManageSemester(capability);

  return (
    <AcademicResourcePage<Semester, SemesterWrite>
      title="Semesters"
      description="The first and second semester of each academic year. Dates are optional until a semester is published."
      entityLabel="Semester"
      entityPlural="semesters"
      load={load}
      columns={COLUMNS}
      getRowKey={(semester) => semester.id}
      getRowLabel={(semester) =>
        `${semester.academic_year.start_year}–${semester.academic_year.end_year}, ${
          semester.number === 1 ? 'first' : 'second'
        } semester`
      }
      searchText={(semester) =>
        `${semester.academic_year.start_year} ${semester.academic_year.end_year} ${
          semester.number === 1 ? 'first' : 'second'
        }`
      }
      hasStatus
      getIsActive={(semester) => semester.is_active}
      getRowAccess={(): RowAccess => ({
        manageable: allowed,
        badge: allowed ? null : 'read-only',
      })}
      createAccess={{
        allowed,
        reason: 'Only a college administrator can create or change semesters.',
      }}
      createFields={semesterFields(
        academicYearOptions(years.items),
        !hasCrossDepartmentAccess(capability),
      )}
      editFields={() =>
        semesterFields(
          academicYearOptions(years.items),
          !hasCrossDepartmentAccess(capability),
        )
      }
      createFormValues={() => semesterFormValues(null)}
      editFormValues={(semester) => semesterFormValues(semester)}
      toPayload={semesterPayload}
      onCreate={(payload) => semestersApi.create(payload)}
      onUpdate={(id, payload) => semestersApi.update(id, payload)}
      onMutated={years.reload}
      isReferenceLoading={years.status === 'loading'}
    />
  );
}
