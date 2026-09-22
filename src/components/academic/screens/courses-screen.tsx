'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { coursesApi, departmentsApi } from '@/lib/academic/api';
import { courseFields, courseFormValues, coursePayload, departmentOptions } from '@/lib/academic/forms';
import { canAccessAcademicModule, courseRowBadge } from '@/lib/academic/permissions';
import type { Course, CourseWrite, Department } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';

export function CoursesScreen() {
  const { capability, context } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => coursesApi.list(signal), []);
  const loadDepartments = useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );
  const departments = useCollection<Department>(loadDepartments);

  const departmentOptionsForForm = useMemo(
    () => departmentOptions(departments.items),
    [departments.items],
  );

  const columns = useMemo<ColumnSpec<Course>[]>(
    () => [
      {
        key: 'code',
        header: 'Code',
        render: (course) => <span className="font-medium">{course.code}</span>,
      },
      { key: 'name', header: 'Name', render: (course) => course.name },
      {
        key: 'department',
        header: 'Owning department',
        render: (course) => `${course.department.code} — ${course.department.name}`,
      },
      {
        key: 'description',
        header: 'Description',
        priority: 'secondary',
        render: (course) =>
          course.description ? (
            <span className="text-muted-foreground">{course.description}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (course) => <ActiveStatusBadge isActive={course.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (course) => {
          const badge = courseRowBadge(capability, course.department.id);
          return badge ? <RowAccessBadgeView badge={badge} /> : null;
        },
      },
    ],
    [capability],
  );

  return (
    <AcademicResourcePage<Course, CourseWrite>
      title="Courses"
      description="Catalog definitions owned by a department. A department also sees courses its students attend through joint teaching."
      entityLabel="Course"
      entityPlural="courses"
      load={load}
      columns={columns}
      getRowKey={(course) => course.id}
      getRowLabel={(course) => `${course.code} — ${course.name}`}
      searchText={(course) =>
        `${course.code} ${course.name} ${course.department.code} ${course.description}`
      }
      hasStatus
      getIsActive={(course) => course.is_active}
      getRowAccess={(course): RowAccess => ({
        manageable: courseRowBadge(capability, course.department.id) === null,
        badge: courseRowBadge(capability, course.department.id),
      })}
      createAccess={{ allowed: canAccessAcademicModule(capability) }}
      createFields={courseFields(departmentOptionsForForm, context.isCollegeAdmin)}
      editFields={() => courseFields(departmentOptionsForForm, context.isCollegeAdmin)}
      createFormValues={() => courseFormValues(null, context)}
      editFormValues={(course) => courseFormValues(course, context)}
      toPayload={coursePayload}
      onCreate={(payload) => coursesApi.create(payload)}
      onUpdate={(id, payload) => coursesApi.update(id, payload)}
      onMutated={departments.reload}
      isReferenceLoading={departments.status === 'loading'}
    />
  );
}
