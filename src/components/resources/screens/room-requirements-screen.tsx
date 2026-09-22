'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { courseOfferingsApi, teachingComponentsApi } from '@/lib/academic/api';
import { teachingComponentOptions } from '@/lib/academic/forms';
import { formatComponentType } from '@/lib/academic/formatters';
import type { CourseOffering, TeachingComponent } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import { roomRequirementsApi, roomTypesApi } from '@/lib/resources/api';
import {
  ROOM_REQUIREMENT_DERIVED_NOTICE,
  SCHEDULER_READ_ONLY_NOTICE,
} from '@/lib/resources/constants';
import {
  roomRequirementFields,
  roomRequirementFormValues,
  roomRequirementPayload,
  roomTypeOptions,
} from '@/lib/resources/forms';
import {
  canManageResources,
  canManageRoomRequirement,
  isSchedulerReadOnly,
} from '@/lib/resources/permissions';
import type {
  RoomType,
  TeachingComponentRoomRequirement,
  TeachingComponentRoomRequirementWrite,
} from '@/lib/resources/types';

export function RoomRequirementsScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback(
    (signal: AbortSignal) => roomRequirementsApi.list({}, signal),
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
  const loadRoomTypes = useCallback(
    (signal: AbortSignal) => roomTypesApi.list({ is_active: true }, signal),
    [],
  );

  const components = useCollection<TeachingComponent>(loadComponents);
  const offerings = useCollection<CourseOffering>(loadOfferings);
  const roomTypes = useCollection<RoomType>(loadRoomTypes);

  const componentDepartment = useMemo(() => {
    const offeringDepartment = new Map<number, number>();
    for (const offering of offerings.items) {
      offeringDepartment.set(offering.id, offering.managing_department.id);
    }
    const map = new Map<number, number | null>();
    for (const component of components.items) {
      map.set(component.id, offeringDepartment.get(component.offering.id) ?? null);
    }
    return map;
  }, [components.items, offerings.items]);

  /**
   * Components this user may configure: every visible component for a college
   * administrator, only the ones its department manages otherwise.
   */
  const writableComponents = useMemo(
    () =>
      components.items.filter((component) =>
        canManageRoomRequirement(capability, componentDepartment.get(component.id) ?? null),
      ),
    [components.items, componentDepartment, capability],
  );

  const componentOptionList = useMemo(
    () => teachingComponentOptions(writableComponents),
    [writableComponents],
  );
  const roomTypeOptionList = useMemo(
    () => roomTypeOptions(roomTypes.items),
    [roomTypes.items],
  );

  const columns = useMemo<ColumnSpec<TeachingComponentRoomRequirement>[]>(
    () => [
      {
        key: 'component',
        header: 'Teaching component',
        render: (requirement) => (
          <span className="font-medium">
            {formatComponentType(requirement.teaching_component.component_type)}
            {requirement.teaching_component.label
              ? ` — ${requirement.teaching_component.label}`
              : ''}
          </span>
        ),
      },
      {
        key: 'room_type',
        header: 'Required room type',
        render: (requirement) =>
          requirement.required_room_type
            ? `${requirement.required_room_type.code} — ${requirement.required_room_type.name}`
            : 'Any',
      },
      {
        key: 'minimum',
        header: 'Explicit minimum',
        priority: 'secondary',
        render: (requirement) =>
          requirement.minimum_capacity === null
            ? 'Uses student count'
            : String(requirement.minimum_capacity),
      },
      {
        key: 'expected',
        header: 'Expected students',
        render: (requirement) => String(requirement.expected_student_count),
      },
      {
        key: 'effective',
        header: 'Effective minimum',
        render: (requirement) => String(requirement.effective_minimum_capacity),
      },
      {
        key: 'capabilities',
        header: 'Required capabilities',
        priority: 'secondary',
        render: (requirement) =>
          requirement.required_capabilities.length === 0
            ? 'None'
            : requirement.required_capabilities
                .map((capability) => capability.code)
                .join(', '),
      },
      {
        key: 'status',
        header: 'Status',
        render: (requirement) => <ActiveStatusBadge isActive={requirement.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (requirement) =>
          canManageRoomRequirement(
            capability,
            componentDepartment.get(requirement.teaching_component.id) ?? null,
          ) ? null : (
            <RowAccessBadgeView badge="external-owner" />
          ),
      },
    ],
    [capability, componentDepartment],
  );

  return (
    <AcademicResourcePage<
      TeachingComponentRoomRequirement,
      TeachingComponentRoomRequirementWrite
    >
      title="Teaching Requirements"
      description={`Room requirements of a teaching component. ${ROOM_REQUIREMENT_DERIVED_NOTICE}`}
      entityLabel="Room requirement"
      entityPlural="room requirements"
      load={load}
      columns={columns}
      getRowKey={(requirement) => requirement.id}
      getRowLabel={(requirement) =>
        formatComponentType(requirement.teaching_component.component_type)
      }
      searchText={(requirement) =>
        `${requirement.teaching_component.label} ${requirement.required_room_type?.code ?? ''}`
      }
      hasStatus
      getIsActive={(requirement) => requirement.is_active}
      getRowAccess={(requirement): RowAccess => {
        const manageable = canManageRoomRequirement(
          capability,
          componentDepartment.get(requirement.teaching_component.id) ?? null,
        );
        return { manageable, badge: manageable ? null : 'external-owner' };
      }}
      createAccess={{
        allowed: canManageResources(capability),
        reason: isSchedulerReadOnly(capability) ? SCHEDULER_READ_ONLY_NOTICE : undefined,
      }}
      createFields={roomRequirementFields(componentOptionList, roomTypeOptionList)}
      editFields={() => roomRequirementFields(componentOptionList, roomTypeOptionList)}
      createFormValues={() => roomRequirementFormValues(null)}
      editFormValues={(requirement) => roomRequirementFormValues(requirement)}
      toPayload={roomRequirementPayload}
      onCreate={(payload) => roomRequirementsApi.create(payload)}
      onUpdate={(id, payload) => roomRequirementsApi.update(id, payload)}
      onMutated={() => {
        components.reload();
        offerings.reload();
        roomTypes.reload();
      }}
      isReferenceLoading={
        components.status === 'loading' ||
        offerings.status === 'loading' ||
        roomTypes.status === 'loading'
      }
    />
  );
}
