'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { Badge } from '@/components/ui/badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { semestersApi } from '@/lib/academic/api';
import { semesterOptions } from '@/lib/academic/forms';
import { formatSemester } from '@/lib/academic/formatters';
import type { Semester } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import { instructorPreferencesApi, instructorsApi } from '@/lib/resources/api';
import {
  PREFERENCE_SOFT_NOTICE,
  SCHEDULER_READ_ONLY_NOTICE,
} from '@/lib/resources/constants';
import {
  formatPreferenceType,
  formatTimeRange,
  formatWeekday,
} from '@/lib/resources/formatters';
import {
  instructorOptions,
  instructorPreferenceFields,
  instructorPreferenceFormValues,
  instructorPreferencePayload,
} from '@/lib/resources/forms';
import {
  canManageInstructorWindows,
  canManageResources,
  isSchedulerReadOnly,
  ownDepartmentId,
} from '@/lib/resources/permissions';
import type {
  InstructorPreference,
  InstructorPreferenceWrite,
  InstructorProfile,
} from '@/lib/resources/types';

export function InstructorPreferencesScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback(
    (signal: AbortSignal) => instructorPreferencesApi.list({}, signal),
    [],
  );
  const loadInstructors = useCallback(
    (signal: AbortSignal) => instructorsApi.list({}, signal),
    [],
  );
  const loadSemesters = useCallback((signal: AbortSignal) => semestersApi.list(signal), []);

  const instructors = useCollection<InstructorProfile>(loadInstructors);
  const semesters = useCollection<Semester>(loadSemesters);

  const instructorDepartment = useMemo(() => {
    const map = new Map<number, number>();
    for (const instructor of instructors.items) {
      map.set(instructor.id, instructor.primary_department.id);
    }
    return map;
  }, [instructors.items]);

  const ownInstructors = useMemo(() => {
    const own = ownDepartmentId(capability);
    return instructors.items.filter(
      (instructor) => instructor.primary_department.id === own,
    );
  }, [instructors.items, capability]);

  const instructorOptionList = useMemo(
    () => instructorOptions(ownInstructors),
    [ownInstructors],
  );
  const semesterOptionList = useMemo(
    () => semesterOptions(semesters.items),
    [semesters.items],
  );

  const columns = useMemo<ColumnSpec<InstructorPreference>[]>(
    () => [
      {
        key: 'instructor',
        header: 'Instructor',
        render: (preference) => (
          <span className="font-medium">{preference.instructor.full_name}</span>
        ),
      },
      {
        key: 'semester',
        header: 'Semester',
        render: (preference) => formatSemester(preference.semester),
      },
      {
        key: 'day',
        header: 'Weekday',
        render: (preference) =>
          preference.day_of_week_display || formatWeekday(preference.day_of_week),
      },
      {
        key: 'window',
        header: 'Window',
        render: (preference) =>
          formatTimeRange(preference.start_time, preference.end_time),
      },
      {
        key: 'preference',
        header: 'Preference',
        render: (preference) => (
          <Badge tone={preference.preference_type === 'PREFERRED' ? 'success' : 'warning'}>
            {preference.preference_type_display ||
              formatPreferenceType(preference.preference_type)}
          </Badge>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        priority: 'secondary',
        render: (preference) =>
          preference.preference_type === 'PREFERRED'
            ? 'Soft preference'
            : 'Soft avoidance (not unavailability)',
      },
      {
        key: 'status',
        header: 'Status',
        render: (preference) => <ActiveStatusBadge isActive={preference.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (preference) =>
          canManageInstructorWindows(
            capability,
            instructorDepartment.get(preference.instructor.id) ?? null,
          ) ? null : (
            <RowAccessBadgeView badge="external-owner" />
          ),
      },
    ],
    [capability, instructorDepartment],
  );

  return (
    <AcademicResourcePage<InstructorPreference, InstructorPreferenceWrite>
      title="Instructor Preferences"
      description={`${PREFERENCE_SOFT_NOTICE} Preferences are separate from the hard availability windows on the Availability page.`}
      entityLabel="Preference"
      entityPlural="preferences"
      load={load}
      columns={columns}
      getRowKey={(preference) => preference.id}
      getRowLabel={(preference) =>
        `${preference.instructor.full_name} ${preference.preference_type_display}`
      }
      searchText={(preference) =>
        `${preference.instructor.full_name} ${preference.preference_type_display} ${preference.day_of_week_display}`
      }
      hasStatus
      getIsActive={(preference) => preference.is_active}
      getRowAccess={(preference): RowAccess => {
        const manageable = canManageInstructorWindows(
          capability,
          instructorDepartment.get(preference.instructor.id) ?? null,
        );
        return { manageable, badge: manageable ? null : 'external-owner' };
      }}
      createAccess={{
        allowed: canManageResources(capability),
        reason: isSchedulerReadOnly(capability) ? SCHEDULER_READ_ONLY_NOTICE : undefined,
      }}
      createFields={instructorPreferenceFields(
        instructorOptionList,
        semesterOptionList,
      )}
      editFields={() =>
        instructorPreferenceFields(instructorOptionList, semesterOptionList)
      }
      createFormValues={() => instructorPreferenceFormValues(null)}
      editFormValues={(preference) => instructorPreferenceFormValues(preference)}
      toPayload={instructorPreferencePayload}
      onCreate={(payload) => instructorPreferencesApi.create(payload)}
      onUpdate={(id, payload) => instructorPreferencesApi.update(id, payload)}
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
