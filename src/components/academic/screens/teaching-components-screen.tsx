'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { courseOfferingsApi, teachingComponentsApi } from '@/lib/academic/api';
import { offeringOptions, teachingComponentFields, teachingComponentFormValues, teachingComponentPayload } from '@/lib/academic/forms';
import {
  formatComponentType,
  formatSessionsPerWeek,
  formatWeeklyHours,
} from '@/lib/academic/formatters';
import {
  canAccessAcademicModule,
  canManageComponent,
  componentRowBadge,
} from '@/lib/academic/permissions';
import type {
  CourseOffering,
  TeachingComponent,
  TeachingComponentWrite,
} from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';

export function TeachingComponentsScreen() {
  const { capability, context } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => teachingComponentsApi.list(signal), []);
  const loadOfferings = useCallback(
    (signal: AbortSignal) => courseOfferingsApi.list(signal),
    [],
  );
  const offerings = useCollection<CourseOffering>(loadOfferings);

  /**
   * A component's managing department is only reachable through its offering, so
   * the offering collection resolves both the capability check and the form
   * options.
   */
  const offeringDepartment = useMemo(() => {
    const map = new Map<number, number>();
    for (const offering of offerings.items) {
      map.set(offering.id, offering.managing_department.id);
    }
    return map;
  }, [offerings.items]);

  const allowedOfferings = useMemo(
    () =>
      context.isCollegeAdmin
        ? offerings.items
        : offerings.items.filter(
            (offering) => offering.managing_department.id === context.ownDepartmentId,
          ),
    [offerings.items, context.isCollegeAdmin, context.ownDepartmentId],
  );

  const offeringOptionList = useMemo(
    () => offeringOptions(allowedOfferings),
    [allowedOfferings],
  );

  const columns = useMemo<ColumnSpec<TeachingComponent>[]>(
    () => [
      {
        key: 'course',
        header: 'Course',
        render: (component) =>
          `${component.offering.course.code} — ${component.offering.course.name}`,
      },
      {
        key: 'offering',
        header: 'Offering',
        render: (component) => component.offering.offering_code,
      },
      {
        key: 'type',
        header: 'Type',
        render: (component) => formatComponentType(component.component_type),
      },
      {
        key: 'label',
        header: 'Label',
        render: (component) =>
          component.label || <span className="text-muted-foreground">—</span>,
      },
      {
        key: 'hours',
        header: 'Weekly hours',
        render: (component) => formatWeeklyHours(component.weekly_hours),
      },
      {
        key: 'duration',
        header: 'Session duration',
        render: (component) => formatWeeklyHours(component.session_duration_hours),
      },
      {
        key: 'sessions',
        header: 'Sessions/week',
        render: (component) => formatSessionsPerWeek(component.sessions_per_week),
      },
      {
        key: 'status',
        header: 'Status',
        render: (component) => <ActiveStatusBadge isActive={component.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (component) => {
          const departmentId = offeringDepartment.get(component.offering.id) ?? null;
          const badge =
            departmentId === null ? null : componentRowBadge(capability, departmentId);
          return badge ? <RowAccessBadgeView badge={badge} /> : null;
        },
      },
    ],
    [capability, offeringDepartment],
  );

  return (
    <AcademicResourcePage<TeachingComponent, TeachingComponentWrite>
      title="Teaching Components"
      description="Theory and practical parts of a course offering, with weekly hours and session length. Sessions per week is calculated by the server."
      entityLabel="Teaching component"
      entityPlural="teaching components"
      load={load}
      columns={columns}
      getRowKey={(component) => component.id}
      getRowLabel={(component) =>
        `${component.offering.course.code} ${formatComponentType(component.component_type)}${
          component.label ? ` (${component.label})` : ''
        }`
      }
      searchText={(component) =>
        `${component.offering.course.code} ${component.offering.course.name} ${
          component.offering.offering_code
        } ${component.label} ${formatComponentType(component.component_type)}`
      }
      hasStatus
      getIsActive={(component) => component.is_active}
      getRowAccess={(component): RowAccess => {
        const departmentId = offeringDepartment.get(component.offering.id) ?? null;
        return {
          manageable: canManageComponent(capability, departmentId),
          badge:
            departmentId === null ? 'read-only' : componentRowBadge(capability, departmentId),
        };
      }}
      createAccess={{ allowed: canAccessAcademicModule(capability) }}
      createFields={teachingComponentFields(offeringOptionList)}
      editFields={() => teachingComponentFields(offeringOptionList)}
      createFormValues={() => teachingComponentFormValues(null)}
      editFormValues={(component) => teachingComponentFormValues(component)}
      toPayload={teachingComponentPayload}
      onCreate={(payload) => teachingComponentsApi.create(payload)}
      onUpdate={(id, payload) => teachingComponentsApi.update(id, payload)}
      onMutated={offerings.reload}
      isReferenceLoading={offerings.status === 'loading'}
    />
  );
}
