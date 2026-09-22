'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { courseOfferingsApi, teachingComponentsApi } from '@/lib/academic/api';
import { formatDateTime } from '@/lib/academic/formatters';
import type { CourseOffering, TeachingComponent } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import {
  roomCapabilitiesApi,
  roomRequirementCapabilitiesApi,
  roomRequirementsApi,
} from '@/lib/resources/api';
import { SCHEDULER_READ_ONLY_NOTICE } from '@/lib/resources/constants';
import { formatComponentType } from '@/lib/resources/formatters';
import {
  roomCapabilityOptions,
  roomRequirementCapabilityFields,
  roomRequirementCapabilityFormValues,
  roomRequirementCapabilityPayload,
  roomRequirementOptions,
} from '@/lib/resources/forms';
import {
  canManageResources,
  canManageRoomRequirement,
  isSchedulerReadOnly,
} from '@/lib/resources/permissions';
import type {
  RoomCapability,
  TeachingComponentCapabilityRequirement,
  TeachingComponentCapabilityRequirementWrite,
  TeachingComponentRoomRequirement,
} from '@/lib/resources/types';

export function RoomRequirementCapabilitiesScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback(
    (signal: AbortSignal) => roomRequirementCapabilitiesApi.list({}, signal),
    [],
  );
  const loadRequirements = useCallback(
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
  const loadCapabilities = useCallback(
    (signal: AbortSignal) => roomCapabilitiesApi.list({ is_active: true }, signal),
    [],
  );

  const requirements = useCollection<TeachingComponentRoomRequirement>(loadRequirements);
  const components = useCollection<TeachingComponent>(loadComponents);
  const offerings = useCollection<CourseOffering>(loadOfferings);
  const capabilities = useCollection<RoomCapability>(loadCapabilities);

  /**
   * Ownership of a required capability follows its room requirement, whose
   * ownership follows the teaching component's offering. The nested summaries do
   * not carry a department, so the chain is resolved from the loaded collections.
   */
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

  const canManageComponent = useCallback(
    (componentId: number): boolean =>
      canManageRoomRequirement(capability, componentDepartment.get(componentId) ?? null),
    [capability, componentDepartment],
  );

  const ownRequirements = useMemo(
    () =>
      requirements.items.filter((requirement) =>
        canManageComponent(requirement.teaching_component.id),
      ),
    [requirements.items, canManageComponent],
  );

  const requirementOptionList = useMemo(
    () => roomRequirementOptions(ownRequirements),
    [ownRequirements],
  );
  const capabilityOptionList = useMemo(
    () => roomCapabilityOptions(capabilities.items),
    [capabilities.items],
  );

  const columns = useMemo<ColumnSpec<TeachingComponentCapabilityRequirement>[]>(
    () => [
      {
        key: 'component',
        header: 'Teaching component',
        render: (row) => (
          <span className="font-medium">
            {formatComponentType(row.room_requirement.teaching_component.component_type)}
            {row.room_requirement.teaching_component.label
              ? ` — ${row.room_requirement.teaching_component.label}`
              : ''}
          </span>
        ),
      },
      {
        key: 'minimum',
        header: 'Requirement minimum',
        priority: 'secondary',
        render: (row) =>
          row.room_requirement.minimum_capacity === null
            ? 'Uses student count'
            : String(row.room_requirement.minimum_capacity),
      },
      {
        key: 'capability',
        header: 'Required capability',
        render: (row) => `${row.capability.code} — ${row.capability.name}`,
      },
      {
        key: 'created',
        header: 'Added',
        priority: 'secondary',
        render: (row) => formatDateTime(row.created_at),
      },
      {
        key: 'access',
        header: 'Access',
        render: (row) =>
          canManageComponent(row.room_requirement.teaching_component.id) ? null : (
            <RowAccessBadgeView badge="external-owner" />
          ),
      },
    ],
    [canManageComponent],
  );

  return (
    <AcademicResourcePage<
      TeachingComponentCapabilityRequirement,
      TeachingComponentCapabilityRequirementWrite
    >
      title="Required Capabilities"
      description="Capabilities a component's room must provide. This link has no active flag and cannot be deleted; edit a row to point it at another capability."
      entityLabel="Required capability"
      entityPlural="required capabilities"
      load={load}
      columns={columns}
      getRowKey={(row) => row.id}
      getRowLabel={(row) => row.capability.code}
      searchText={(row) =>
        `${row.capability.code} ${row.capability.name} ${row.room_requirement.teaching_component.label}`
      }
      hasStatus={false}
      getRowAccess={(row): RowAccess => {
        const manageable = canManageComponent(row.room_requirement.teaching_component.id);
        return { manageable, badge: manageable ? null : 'external-owner' };
      }}
      createAccess={{
        allowed: canManageResources(capability),
        reason: isSchedulerReadOnly(capability) ? SCHEDULER_READ_ONLY_NOTICE : undefined,
      }}
      createFields={roomRequirementCapabilityFields(
        requirementOptionList,
        capabilityOptionList,
      )}
      editFields={() =>
        roomRequirementCapabilityFields(requirementOptionList, capabilityOptionList)
      }
      createFormValues={() => roomRequirementCapabilityFormValues(null)}
      editFormValues={(row) => roomRequirementCapabilityFormValues(row)}
      toPayload={roomRequirementCapabilityPayload}
      onCreate={(payload) => roomRequirementCapabilitiesApi.create(payload)}
      onUpdate={(id, payload) => roomRequirementCapabilitiesApi.update(id, payload)}
      onMutated={() => {
        requirements.reload();
        components.reload();
        offerings.reload();
        capabilities.reload();
      }}
      isReferenceLoading={
        requirements.status === 'loading' ||
        components.status === 'loading' ||
        offerings.status === 'loading' ||
        capabilities.status === 'loading'
      }
    />
  );
}
