'use client';

import { useCallback } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { academicYearsApi } from '@/lib/academic/api';
import { formatAcademicYear } from '@/lib/academic/formatters';
import {
  academicYearFields,
  academicYearFormValues,
  academicYearPayload,
  applyAcademicYearDerivation,
} from '@/lib/academic/forms';
import { canManageAcademicYear } from '@/lib/academic/permissions';
import type { AcademicYear, AcademicYearWrite } from '@/lib/academic/types';

const COLUMNS: ColumnSpec<AcademicYear>[] = [
  {
    key: 'range',
    header: 'Academic year',
    render: (year) => (
      <span className="font-medium">{formatAcademicYear(year)}</span>
    ),
  },
  {
    key: 'start',
    header: 'Start year',
    priority: 'secondary',
    render: (year) => String(year.start_year),
  },
  {
    key: 'end',
    header: 'End year',
    priority: 'secondary',
    render: (year) => String(year.end_year),
  },
  {
    key: 'status',
    header: 'Status',
    render: (year) => <ActiveStatusBadge isActive={year.is_active} />,
  },
];

export function AcademicYearsScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => academicYearsApi.list(signal), []);
  const allowed = canManageAcademicYear(capability);

  return (
    <AcademicResourcePage<AcademicYear, AcademicYearWrite>
      title="Academic Years"
      description="College-wide academic years. The end year is always exactly one year after the start year."
      entityLabel="Academic year"
      entityPlural="academic years"
      load={load}
      columns={COLUMNS}
      getRowKey={(year) => year.id}
      getRowLabel={(year) => formatAcademicYear(year)}
      searchText={(year) => `${year.start_year} ${year.end_year} ${formatAcademicYear(year)}`}
      hasStatus
      getIsActive={(year) => year.is_active}
      getRowAccess={(): RowAccess => ({
        manageable: allowed,
        badge: allowed ? null : 'read-only',
      })}
      createAccess={{
        allowed,
        reason: 'Only a college administrator can create or change academic years.',
      }}
      createFields={academicYearFields()}
      editFields={() => academicYearFields()}
      createFormValues={() => academicYearFormValues(null)}
      editFormValues={(year) => academicYearFormValues(year)}
      toPayload={academicYearPayload}
      deriveValues={applyAcademicYearDerivation}
      onCreate={(payload) => academicYearsApi.create(payload)}
      onUpdate={(id, payload) => academicYearsApi.update(id, payload)}
    />
  );
}
