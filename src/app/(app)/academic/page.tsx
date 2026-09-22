import type { Metadata } from 'next';

import {
  AcademicModuleGroup,
  type AcademicModuleLink,
} from '@/components/academic/module-card';
import { PageHeading } from '@/components/ui/page-heading';
import { ACADEMIC_ROUTES } from '@/lib/academic/constants';

export const metadata: Metadata = {
  title: 'Academic Administration',
};

const INSTITUTIONAL_STRUCTURE: AcademicModuleLink[] = [
  {
    href: ACADEMIC_ROUTES.colleges,
    label: 'Colleges',
    description: 'The college this deployment serves.',
  },
  {
    href: ACADEMIC_ROUTES.departments,
    label: 'Departments',
    description: 'Departments that own programs, courses and schedules.',
  },
  {
    href: ACADEMIC_ROUTES.academicYears,
    label: 'Academic Years',
    description: 'College-wide academic years such as 2026–2027.',
  },
  {
    href: ACADEMIC_ROUTES.semesters,
    label: 'Semesters',
    description: 'First and second semester of each academic year.',
  },
];

const PROGRAMS_AND_STUDENTS: AcademicModuleLink[] = [
  {
    href: ACADEMIC_ROUTES.programs,
    label: 'Study Programs',
    description: 'Undergraduate, master’s and PhD programs per department.',
  },
  {
    href: ACADEMIC_ROUTES.stages,
    label: 'Study Stages',
    description: 'The numbered stages inside each study program.',
  },
  {
    href: ACADEMIC_ROUTES.studentGroups,
    label: 'Student Groups',
    description: 'Groups and practical subgroups with their student counts.',
  },
];

const TEACHING_STRUCTURE: AcademicModuleLink[] = [
  {
    href: ACADEMIC_ROUTES.courses,
    label: 'Courses',
    description: 'Catalog definitions owned by a department.',
  },
  {
    href: ACADEMIC_ROUTES.courseOfferings,
    label: 'Course Offerings',
    description: 'A course delivered in a semester by a managing department.',
  },
  {
    href: ACADEMIC_ROUTES.teachingComponents,
    label: 'Teaching Components',
    description: 'Theory and practical parts with weekly hours.',
  },
  {
    href: ACADEMIC_ROUTES.componentGroups,
    label: 'Component Groups',
    description: 'Which student groups attend each teaching component.',
  },
];

export default function AcademicAdministrationPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        title="Academic Administration"
        description="Maintain the academic structure the college plans against. Records are retired with “Deactivate”; nothing here is deleted."
      />
      <AcademicModuleGroup
        title="Institutional Structure"
        links={INSTITUTIONAL_STRUCTURE}
      />
      <AcademicModuleGroup title="Programs & Students" links={PROGRAMS_AND_STUDENTS} />
      <AcademicModuleGroup title="Teaching Structure" links={TEACHING_STRUCTURE} />
    </div>
  );
}
