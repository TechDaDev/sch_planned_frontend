'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { Badge } from '@/components/ui/badge';
import { departmentsApi, programsApi, semestersApi, stagesApi, studentGroupsApi } from '@/lib/academic/api';
import {
  departmentOptions,
  semesterOptions,
  studentGroupOptions,
} from '@/lib/academic/forms';
import { formatSemester } from '@/lib/academic/formatters';
import type {
  Department,
  Semester,
  StudentGroup,
  StudyProgram,
  StudyStage,
} from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import {
  calendarExceptionsApi,
  instructorsApi,
  roomsApi,
} from '@/lib/resources/api';
import {
  COLLEGE_WIDE_EXCEPTION_NOTICE,
  EXCEPTION_SCOPE_OPTIONS,
  SCHEDULER_READ_ONLY_NOTICE,
} from '@/lib/resources/constants';
import { validateExceptionSemesterDate } from '@/lib/resources/calendar';
import {
  formatExceptionScope,
  formatExceptionTarget,
  formatExceptionType,
  formatFullDay,
  formatTimeRange,
} from '@/lib/resources/formatters';
import type { FieldOption, FormFieldSpec } from '@/lib/resources/forms';
import {
  applyExceptionDerivation,
  calendarExceptionFields,
  calendarExceptionFormValues,
  calendarExceptionPayload,
  instructorOptions,
  roomOptions,
} from '@/lib/resources/forms';
import {
  canCreateExceptionForScope,
  canManageCalendarException,
  canManageResources,
  isSchedulerReadOnly,
  ownDepartmentId,
} from '@/lib/resources/permissions';
import type {
  CalendarException,
  CalendarExceptionWrite,
  InstructorProfile,
  Room,
  ExceptionScope,
} from '@/lib/resources/types';

export function CalendarExceptionsScreen() {
  const { capability } = useAcademicUser();
  const load = useCallback(
    (signal: AbortSignal) => calendarExceptionsApi.list({}, signal),
    [],
  );
  const loadSemesters = useCallback((signal: AbortSignal) => semestersApi.list(signal), []);
  const loadDepartments = useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );
  const loadInstructors = useCallback(
    (signal: AbortSignal) => instructorsApi.list({}, signal),
    [],
  );
  const loadRooms = useCallback((signal: AbortSignal) => roomsApi.list({}, signal), []);
  const loadGroups = useCallback(
    (signal: AbortSignal) => studentGroupsApi.list(signal),
    [],
  );
  const loadStages = useCallback((signal: AbortSignal) => stagesApi.list(signal), []);
  const loadPrograms = useCallback((signal: AbortSignal) => programsApi.list(signal), []);

  const semesters = useCollection<Semester>(loadSemesters);
  const departments = useCollection<Department>(loadDepartments);
  const instructors = useCollection<InstructorProfile>(loadInstructors);
  const rooms = useCollection<Room>(loadRooms);
  const groups = useCollection<StudentGroup>(loadGroups);
  const stages = useCollection<StudyStage>(loadStages);
  const programs = useCollection<StudyProgram>(loadPrograms);

  const own = ownDepartmentId(capability);

  /**
   * Scope ownership is resolved from the loaded collections: an exception row
   * carries only a shallow target summary, and a *shared* instructor or room is
   * visible without being manageable.
   */
  const ownership = useMemo(() => {
    const instructorDepartment = new Map<number, number>();
    for (const instructor of instructors.items) {
      instructorDepartment.set(instructor.id, instructor.primary_department.id);
    }
    const roomOwner = new Map<number, number>();
    for (const room of rooms.items) {
      roomOwner.set(room.id, room.owner_department.id);
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
    return { instructorDepartment, roomOwner, groupDepartment };
  }, [instructors.items, rooms.items, groups.items, stages.items, programs.items]);

  const targetDepartment = useCallback(
    (exception: CalendarException): number | null => {
      const targetId = exception.target?.id;
      if (targetId === undefined) {
        return null;
      }
      switch (exception.scope_type) {
        case 'DEPARTMENT':
          return targetId;
        case 'INSTRUCTOR':
          return ownership.instructorDepartment.get(targetId) ?? null;
        case 'ROOM':
          return ownership.roomOwner.get(targetId) ?? null;
        case 'STUDENT_GROUP':
          return ownership.groupDepartment.get(targetId) ?? null;
        default:
          return null;
      }
    },
    [ownership],
  );

  const manageable = useCallback(
    (exception: CalendarException): boolean =>
      canManageCalendarException(
        capability,
        targetDepartment(exception),
        exception.scope_type,
      ),
    [capability, targetDepartment],
  );

  // A department administrator cannot create college-wide exceptions, so that
  // scope is not offered to them at all.
  const scopeOptions = useMemo<FieldOption[]>(
    () =>
      EXCEPTION_SCOPE_OPTIONS.filter((option) =>
        canCreateExceptionForScope(capability, option.value as ExceptionScope),
      ),
    [capability],
  );

  const semesterOptionList = useMemo(
    () => semesterOptions(semesters.items),
    [semesters.items],
  );
  const departmentOptionList = useMemo(
    () =>
      departmentOptions(
        own === null
          ? departments.items
          : departments.items.filter((department) => department.id === own),
      ),
    [departments.items, own],
  );
  const instructorOptionList = useMemo(
    () =>
      instructorOptions(
        own === null
          ? instructors.items
          : instructors.items.filter(
              (instructor) => instructor.primary_department.id === own,
            ),
      ),
    [instructors.items, own],
  );
  const roomOptionList = useMemo(
    () =>
      roomOptions(
        own === null
          ? rooms.items
          : rooms.items.filter((room) => room.owner_department.id === own),
      ),
    [rooms.items, own],
  );
  const groupOptionList = useMemo(
    () =>
      studentGroupOptions(
        own === null
          ? groups.items
          : groups.items.filter(
              (group) => ownership.groupDepartment.get(group.id) === own,
            ),
      ),
    [groups.items, ownership, own],
  );

  /**
   * Target selectors are filled per scope, and the date check is completed with
   * the selected semester's configured range (when it has one).
   */
  const resolveField = useCallback(
    (field: FormFieldSpec, values: Record<string, string>): FormFieldSpec => {
      if (field.name === 'department') {
        return { ...field, options: departmentOptionList };
      }
      if (field.name === 'instructor') {
        return { ...field, options: instructorOptionList };
      }
      if (field.name === 'room') {
        return { ...field, options: roomOptionList };
      }
      if (field.name === 'student_group') {
        return { ...field, options: groupOptionList };
      }
      if (field.name === 'date') {
        return {
          ...field,
          validate: (value) => {
            if (value.trim().length === 0) {
              return 'Date is required.';
            }
            const semester = semesters.items.find(
              (candidate) => String(candidate.id) === values.semester,
            );
            const errors = validateExceptionSemesterDate(
              value,
              semester
                ? {
                    id: semester.id,
                    number: semester.number,
                    academic_year: semester.academic_year,
                  }
                : null,
              semester
                ? { start_date: semester.start_date, end_date: semester.end_date }
                : null,
            );
            return errors.date ?? null;
          },
        };
      }
      return field;
    },
    [departmentOptionList, instructorOptionList, roomOptionList, groupOptionList, semesters.items],
  );

  const columns = useMemo<ColumnSpec<CalendarException>[]>(
    () => [
      {
        key: 'date',
        header: 'Date',
        render: (exception) => <span className="font-medium">{exception.date}</span>,
      },
      {
        key: 'type',
        header: 'Type',
        render: (exception) => formatExceptionType(exception.exception_type),
      },
      {
        key: 'scope',
        header: 'Scope',
        render: (exception) => formatExceptionScope(exception.scope_type),
      },
      {
        key: 'target',
        header: 'Target',
        render: (exception) => formatExceptionTarget(exception.target),
      },
      {
        key: 'window',
        header: 'Time',
        render: (exception) =>
          exception.is_full_day ? (
            <Badge tone="neutral">{formatFullDay(true)}</Badge>
          ) : (
            formatTimeRange(exception.start_time, exception.end_time)
          ),
      },
      {
        key: 'semester',
        header: 'Semester',
        priority: 'secondary',
        render: (exception) => formatSemester(exception.semester),
      },
      {
        key: 'title',
        header: 'Title',
        render: (exception) => exception.title,
      },
      {
        key: 'status',
        header: 'Status',
        render: (exception) => <ActiveStatusBadge isActive={exception.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (exception) =>
          manageable(exception) ? null : <RowAccessBadgeView badge="external-owner" />,
      },
    ],
    [manageable],
  );

  return (
    <AcademicResourcePage<CalendarException, CalendarExceptionWrite>
      title="Calendar Exceptions"
      description={`Dated exceptions to the weekly grid. College-wide exceptions affect everybody; the other scopes target one department, instructor, room or student group. ${COLLEGE_WIDE_EXCEPTION_NOTICE}`}
      entityLabel="Calendar exception"
      entityPlural="calendar exceptions"
      load={load}
      columns={columns}
      getRowKey={(exception) => exception.id}
      getRowLabel={(exception) =>
        `${formatExceptionType(exception.exception_type)} on ${exception.date}`
      }
      searchText={(exception) =>
        `${exception.date} ${exception.title} ${exception.exception_type_display} ${exception.scope_type_display} ${formatExceptionTarget(exception.target)}`
      }
      hasStatus
      getIsActive={(exception) => exception.is_active}
      getRowAccess={(exception): RowAccess => {
        const canManage = manageable(exception);
        return { manageable: canManage, badge: canManage ? null : 'external-owner' };
      }}
      createAccess={{
        allowed: canManageResources(capability) && scopeOptions.length > 0,
        reason: isSchedulerReadOnly(capability) ? SCHEDULER_READ_ONLY_NOTICE : undefined,
      }}
      createFields={calendarExceptionFields(semesterOptionList, scopeOptions)}
      editFields={() => calendarExceptionFields(semesterOptionList, scopeOptions)}
      createFormValues={() => calendarExceptionFormValues(null)}
      editFormValues={(exception) => calendarExceptionFormValues(exception)}
      toPayload={calendarExceptionPayload}
      deriveValues={applyExceptionDerivation}
      resolveField={resolveField}
      onCreate={(payload) => calendarExceptionsApi.create(payload)}
      onUpdate={(id, payload) => calendarExceptionsApi.update(id, payload)}
      onMutated={() => {
        semesters.reload();
        departments.reload();
        instructors.reload();
        rooms.reload();
        groups.reload();
        stages.reload();
        programs.reload();
      }}
      isReferenceLoading={
        semesters.status === 'loading' ||
        departments.status === 'loading' ||
        instructors.status === 'loading' ||
        rooms.status === 'loading' ||
        groups.status === 'loading'
      }
    />
  );
}
