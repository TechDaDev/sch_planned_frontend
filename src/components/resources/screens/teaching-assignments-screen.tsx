'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { Badge } from '@/components/ui/badge';
import { courseOfferingsApi, teachingComponentsApi } from '@/lib/academic/api';
import { teachingComponentOptions } from '@/lib/academic/forms';
import { formatComponentType } from '@/lib/academic/formatters';
import type { CourseOffering, TeachingComponent } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import {
  instructorAccessApi,
  instructorsApi,
  teachingAssignmentsApi,
} from '@/lib/resources/api';
import {
  SCHEDULER_READ_ONLY_NOTICE,
  SINGLE_PRIMARY_HINT,
} from '@/lib/resources/constants';
import {
  formatAssignmentRole,
  formatInstructor,
} from '@/lib/resources/formatters';
import {
  instructorOptions,
  teachingAssignmentFields,
  teachingAssignmentFormValues,
  teachingAssignmentPayload,
} from '@/lib/resources/forms';
import {
  canManageResources,
  canManageTeachingAssignment,
  hasCrossDepartmentAccess,
  isSchedulerReadOnly,
  ownDepartmentId,
} from '@/lib/resources/permissions';
import type {
  InstructorDepartmentAccess,
  InstructorProfile,
  TeachingAssignment,
  TeachingAssignmentWrite,
} from '@/lib/resources/types';

export function TeachingAssignmentsScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback(
    (signal: AbortSignal) => teachingAssignmentsApi.list({}, signal),
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
  const loadInstructors = useCallback(
    (signal: AbortSignal) => instructorsApi.list({}, signal),
    [],
  );
  const loadGrants = useCallback(
    (signal: AbortSignal) => instructorAccessApi.list({ is_active: true }, signal),
    [],
  );

  const components = useCollection<TeachingComponent>(loadComponents);
  const offerings = useCollection<CourseOffering>(loadOfferings);
  const instructors = useCollection<InstructorProfile>(loadInstructors);
  const grants = useCollection<InstructorDepartmentAccess>(loadGrants);

  /**
   * A component's managing department is only reachable through its offering, so
   * ownership is resolved from the loaded offering collection.
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

  const own = ownDepartmentId(capability);
  const isCollegeAdminUser = hasCrossDepartmentAccess(capability);

  /**
   * Components this user may staff: every visible component for a college
   * administrator, only the ones its department manages otherwise.
   */
  const writableComponents = useMemo(
    () =>
      components.items.filter((component) =>
        canManageTeachingAssignment(
          capability,
          componentDepartment.get(component.id) ?? null,
        ),
      ),
    [components.items, componentDepartment, capability],
  );

  const componentOptionList = useMemo(
    () => teachingComponentOptions(writableComponents),
    [writableComponents],
  );

  /**
   * Instructor choices are narrowed to the ones that look eligible for this
   * department: its own instructors, college-wide resources and instructors with
   * an active grant to it. Eligibility is still decided by the backend.
   */
  const eligibleInstructors = useMemo(() => {
    if (isCollegeAdminUser) {
      return instructors.items;
    }
    const grantedIds = new Set(
      grants.items
        .filter((grant) => grant.is_active && grant.department.id === own)
        .map((grant) => grant.instructor.id),
    );
    return instructors.items.filter(
      (instructor) =>
        instructor.primary_department.id === own ||
        instructor.sharing_scope === 'COLLEGE_WIDE' ||
        grantedIds.has(instructor.id),
    );
  }, [instructors.items, grants.items, isCollegeAdminUser, own]);

  const instructorOptionList = useMemo(
    () => instructorOptions(eligibleInstructors),
    [eligibleInstructors],
  );

  const columns = useMemo<ColumnSpec<TeachingAssignment>[]>(
    () => [
      {
        key: 'component',
        header: 'Teaching component',
        render: (assignment) => (
          <span className="font-medium">
            {formatComponentType(assignment.teaching_component.component_type)}
            {assignment.teaching_component.label
              ? ` — ${assignment.teaching_component.label}`
              : ''}
          </span>
        ),
      },
      {
        key: 'course',
        header: 'Course / offering',
        render: (assignment) =>
          `${assignment.offering.course.code} — ${assignment.offering.course.name} [${assignment.offering.offering_code}]`,
      },
      {
        key: 'instructor',
        header: 'Instructor',
        render: (assignment) => formatInstructor(assignment.instructor),
      },
      {
        key: 'role',
        header: 'Role',
        render: (assignment) => (
          <Badge tone={assignment.assignment_role === 'PRIMARY' ? 'info' : 'neutral'}>
            {formatAssignmentRole(assignment.assignment_role)}
          </Badge>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (assignment) => <ActiveStatusBadge isActive={assignment.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (assignment) =>
          canManageTeachingAssignment(
            capability,
            componentDepartment.get(assignment.teaching_component.id) ?? null,
          ) ? null : (
            <RowAccessBadgeView badge="external-owner" />
          ),
      },
    ],
    [capability, componentDepartment],
  );

  return (
    <AcademicResourcePage<TeachingAssignment, TeachingAssignmentWrite>
      title="Teaching Assignments"
      description={`Staffing of teaching components. ${SINGLE_PRIMARY_HINT} The server rechecks instructor eligibility for the managing department.`}
      entityLabel="Teaching assignment"
      entityPlural="teaching assignments"
      load={load}
      columns={columns}
      getRowKey={(assignment) => assignment.id}
      getRowLabel={(assignment) =>
        `${assignment.offering.course.code} — ${assignment.instructor.full_name}`
      }
      searchText={(assignment) =>
        `${assignment.offering.course.code} ${assignment.offering.course.name} ${
          assignment.instructor.full_name
        } ${assignment.instructor.staff_code ?? ''} ${
          assignment.teaching_component.label
        } ${formatAssignmentRole(assignment.assignment_role)}`
      }
      hasStatus
      getIsActive={(assignment) => assignment.is_active}
      getRowAccess={(assignment): RowAccess => {
        const manageable = canManageTeachingAssignment(
          capability,
          componentDepartment.get(assignment.teaching_component.id) ?? null,
        );
        return { manageable, badge: manageable ? null : 'external-owner' };
      }}
      createAccess={{
        allowed: canManageResources(capability),
        reason: isSchedulerReadOnly(capability) ? SCHEDULER_READ_ONLY_NOTICE : undefined,
      }}
      createFields={teachingAssignmentFields(componentOptionList, instructorOptionList)}
      editFields={() =>
        teachingAssignmentFields(componentOptionList, instructorOptionList)
      }
      createFormValues={() => teachingAssignmentFormValues(null)}
      editFormValues={(assignment) => teachingAssignmentFormValues(assignment)}
      toPayload={teachingAssignmentPayload}
      onCreate={(payload) => teachingAssignmentsApi.create(payload)}
      onUpdate={(id, payload) => teachingAssignmentsApi.update(id, payload)}
      onMutated={() => {
        components.reload();
        offerings.reload();
        instructors.reload();
        grants.reload();
      }}
      isReferenceLoading={
        components.status === 'loading' ||
        offerings.status === 'loading' ||
        instructors.status === 'loading'
      }
    />
  );
}
