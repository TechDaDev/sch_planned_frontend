'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { semestersApi } from '@/lib/academic/api';
import { semesterOptions } from '@/lib/academic/forms';
import { formatSemester } from '@/lib/academic/formatters';
import type { Semester } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import { instructorAvailabilityApi, instructorsApi } from '@/lib/resources/api';
import { AVAILABILITY_HARD_NOTICE, SCHEDULER_READ_ONLY_NOTICE } from '@/lib/resources/constants';
import { formatTimeRange, formatWeekday } from '@/lib/resources/formatters';
import {
  instructorAvailabilityFields,
  instructorAvailabilityFormValues,
  instructorAvailabilityPayload,
  instructorOptions,
} from '@/lib/resources/forms';
import {
  canManageInstructorWindows,
  canManageResources,
  isSchedulerReadOnly,
} from '@/lib/resources/permissions';
import type {
  InstructorAvailability,
  InstructorAvailabilityWrite,
  InstructorProfile,
} from '@/lib/resources/types';

export function InstructorAvailabilityScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback(
    (signal: AbortSignal) => instructorAvailabilityApi.list({}, signal),
    [],
  );
  const loadInstructors = useCallback(
    (signal: AbortSignal) => instructorsApi.list({}, signal),
    [],
  );
  const loadSemesters = useCallback((signal: AbortSignal) => semestersApi.list(signal), []);

  const instructors = useCollection<InstructorProfile>(loadInstructors);
  const semesters = useCollection<Semester>(loadSemesters);

  /**
   * Windows belong to the instructor's primary department, but the nested
   * instructor summary has no department, so ownership is resolved from the
   * loaded instructors.
   */
  const instructorDepartment = useMemo(() => {
    const map = new Map<number, number>();
    for (const instructor of instructors.items) {
      map.set(instructor.id, instructor.primary_department.id);
    }
    return map;
  }, [instructors.items]);

  /**
   * Instructors this user may write availability for: every visible instructor
   * for a college administrator, only the own department's otherwise.
   */
  const writableInstructors = useMemo(
    () =>
      instructors.items.filter((instructor) =>
        canManageInstructorWindows(capability, instructor.primary_department.id),
      ),
    [instructors.items, capability],
  );

  const instructorOptionList = useMemo(
    () => instructorOptions(writableInstructors),
    [writableInstructors],
  );
  const semesterOptionList = useMemo(
    () => semesterOptions(semesters.items),
    [semesters.items],
  );

  const columns = useMemo<ColumnSpec<InstructorAvailability>[]>(
    () => [
      {
        key: 'instructor',
        header: 'Instructor',
        render: (window) => (
          <span className="font-medium">{window.instructor.full_name}</span>
        ),
      },
      {
        key: 'semester',
        header: 'Semester',
        render: (window) => formatSemester(window.semester),
      },
      {
        key: 'day',
        header: 'Weekday',
        render: (window) =>
          window.day_of_week_display || formatWeekday(window.day_of_week),
      },
      {
        key: 'window',
        header: 'Available',
        render: (window) => formatTimeRange(window.start_time, window.end_time),
      },
      {
        key: 'status',
        header: 'Status',
        render: (window) => <ActiveStatusBadge isActive={window.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (window) =>
          canManageInstructorWindows(
            capability,
            instructorDepartment.get(window.instructor.id) ?? null,
          ) ? null : (
            <RowAccessBadgeView badge="external-owner" />
          ),
      },
    ],
    [capability, instructorDepartment],
  );

  return (
    <AcademicResourcePage<InstructorAvailability, InstructorAvailabilityWrite>
      title="Instructor Availability"
      description={AVAILABILITY_HARD_NOTICE}
      entityLabel="Availability window"
      entityPlural="availability windows"
      load={load}
      columns={columns}
      getRowKey={(window) => window.id}
      getRowLabel={(window) =>
        `${window.instructor.full_name} ${window.day_of_week_display} ${formatTimeRange(
          window.start_time,
          window.end_time,
        )}`
      }
      searchText={(window) =>
        `${window.instructor.full_name} ${window.day_of_week_display} ${formatSemester(
          window.semester,
        )}`
      }
      hasStatus
      getIsActive={(window) => window.is_active}
      getRowAccess={(window): RowAccess => {
        const manageable = canManageInstructorWindows(
          capability,
          instructorDepartment.get(window.instructor.id) ?? null,
        );
        return { manageable, badge: manageable ? null : 'external-owner' };
      }}
      createAccess={{
        allowed: canManageResources(capability),
        reason: isSchedulerReadOnly(capability) ? SCHEDULER_READ_ONLY_NOTICE : undefined,
      }}
      createFields={instructorAvailabilityFields(
        instructorOptionList,
        semesterOptionList,
      )}
      editFields={() =>
        instructorAvailabilityFields(instructorOptionList, semesterOptionList)
      }
      createFormValues={() => instructorAvailabilityFormValues(null)}
      editFormValues={(window) => instructorAvailabilityFormValues(window)}
      toPayload={instructorAvailabilityPayload}
      onCreate={(payload) => instructorAvailabilityApi.create(payload)}
      onUpdate={(id, payload) => instructorAvailabilityApi.update(id, payload)}
      onMutated={() => {
        instructors.reload();
        semesters.reload();
      }}
      isReferenceLoading={
        instructors.status === 'loading' || semesters.status === 'loading'
      }
    />
  );
}
