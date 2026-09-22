'use client';

import { useCallback, useMemo } from 'react';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ActiveStatusBadge, RowAccessBadgeView } from '@/components/academic/status-badge';
import { useAcademicUser } from '@/components/academic/use-academic-user';
import { courseOfferingsApi, coursesApi, semestersApi } from '@/lib/academic/api';
import {
  courseOptions,
  courseOfferingFields,
  courseOfferingFormValues,
  courseOfferingPayload,
  applyOfferingDerivation,
  departmentOptions,
  semesterOptions,
} from '@/lib/academic/forms';
import { formatHours, formatSemester } from '@/lib/academic/formatters';
import {
  canAccessAcademicModule,
  canManageOffering,
  offeringRowBadge,
} from '@/lib/academic/permissions';
import type {
  Course,
  CourseOffering,
  CourseOfferingWrite,
  Department,
  Semester,
} from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import { departmentsApi } from '@/lib/academic/api';

export function CourseOfferingsScreen() {
  const { capability, context } = useAcademicUser();
  const load = useCallback((signal: AbortSignal) => courseOfferingsApi.list(signal), []);
  const loadCourses = useCallback((signal: AbortSignal) => coursesApi.list(signal), []);
  const loadSemesters = useCallback((signal: AbortSignal) => semestersApi.list(signal), []);
  const loadDepartments = useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );

  const courses = useCollection<Course>(loadCourses);
  const semesters = useCollection<Semester>(loadSemesters);
  const departments = useCollection<Department>(loadDepartments);

  const courseOptionList = useMemo(
    () =>
      courseOptions(
        context.isCollegeAdmin
          ? courses.items
          : courses.items.filter(
              (course) => course.department.id === context.ownDepartmentId,
            ),
      ),
    [courses.items, context.isCollegeAdmin, context.ownDepartmentId],
  );

  const semesterOptionList = useMemo(
    () => semesterOptions(semesters.items),
    [semesters.items],
  );
  const departmentOptionList = useMemo(
    () => departmentOptions(departments.items),
    [departments.items],
  );

  const columns = useMemo<ColumnSpec<CourseOffering>[]>(
    () => [
      {
        key: 'offering',
        header: 'Offering',
        render: (offering) => (
          <span className="font-medium">{offering.offering_code}</span>
        ),
      },
      {
        key: 'course',
        header: 'Course',
        render: (offering) => `${offering.course.code} — ${offering.course.name}`,
      },
      {
        key: 'semester',
        header: 'Semester',
        render: (offering) => formatSemester(offering.semester),
      },
      {
        key: 'manager',
        header: 'Managing department',
        render: (offering) =>
          `${offering.managing_department.code} — ${offering.managing_department.name}`,
      },
      {
        key: 'hours',
        header: 'Weekly hours',
        render: (offering) => `${formatHours(offering.total_weekly_hours)} h`,
      },
      {
        key: 'status',
        header: 'Status',
        render: (offering) => <ActiveStatusBadge isActive={offering.is_active} />,
      },
      {
        key: 'access',
        header: 'Access',
        render: (offering) => {
          const badge = offeringRowBadge(capability, offering.managing_department.id);
          return badge ? <RowAccessBadgeView badge={badge} /> : null;
        },
      },
    ],
    [capability],
  );

  return (
    <AcademicResourcePage<CourseOffering, CourseOfferingWrite>
      title="Course Offerings"
      description="A course delivered in one semester. The managing department is always the department that owns the course."
      entityLabel="Course offering"
      entityPlural="course offerings"
      load={load}
      columns={columns}
      getRowKey={(offering) => offering.id}
      getRowLabel={(offering) =>
        `${offering.course.code} — ${offering.course.name} [${offering.offering_code}]`
      }
      searchText={(offering) =>
        `${offering.offering_code} ${offering.course.code} ${offering.course.name} ${offering.managing_department.code}`
      }
      hasStatus
      getIsActive={(offering) => offering.is_active}
      getRowAccess={(offering): RowAccess => ({
        manageable: canManageOffering(capability, offering.managing_department.id),
        badge: offeringRowBadge(capability, offering.managing_department.id),
      })}
      createAccess={{ allowed: canAccessAcademicModule(capability) }}
      createFields={courseOfferingFields(
        courseOptionList,
        semesterOptionList,
        departmentOptionList,
      )}
      editFields={() =>
        courseOfferingFields(courseOptionList, semesterOptionList, departmentOptionList)
      }
      createFormValues={() => courseOfferingFormValues(null, courses.items)}
      editFormValues={(offering) => courseOfferingFormValues(offering, courses.items)}
      toPayload={courseOfferingPayload}
      deriveValues={(name, value, values) =>
        applyOfferingDerivation(courses.items, name, value, values)
      }
      onCreate={(payload) => courseOfferingsApi.create(payload)}
      onUpdate={(id, payload) => courseOfferingsApi.update(id, payload)}
      onMutated={() => {
        courses.reload();
        semesters.reload();
        departments.reload();
      }}
      isReferenceLoading={
        courses.status === 'loading' ||
        semesters.status === 'loading' ||
        departments.status === 'loading'
      }
    />
  );
}
