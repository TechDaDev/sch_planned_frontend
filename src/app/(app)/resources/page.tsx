import type { Metadata } from 'next';

import {
  AcademicModuleGroup,
  type AcademicModuleLink,
} from '@/components/academic/module-card';
import { PageHeading } from '@/components/ui/page-heading';
import { RESOURCE_ROUTES } from '@/lib/resources/constants';

export const metadata: Metadata = {
  title: 'Resources',
};

const INSTRUCTORS: AcademicModuleLink[] = [
  {
    href: RESOURCE_ROUTES.instructors,
    label: 'Instructor Profiles',
    description: 'Department-owned instructors as schedulable teaching resources.',
  },
  {
    href: RESOURCE_ROUTES.instructorSharing,
    label: 'Sharing',
    description: 'Grants letting another department schedule an instructor.',
  },
  {
    href: RESOURCE_ROUTES.instructorAvailability,
    label: 'Availability',
    description: 'Hard weekly availability windows per semester.',
  },
  {
    href: RESOURCE_ROUTES.instructorPreferences,
    label: 'Preferences',
    description: 'Soft preferred and avoided windows — not unavailability.',
  },
  {
    href: RESOURCE_ROUTES.teachingAssignments,
    label: 'Teaching Assignments',
    description: 'Which instructor teaches which teaching component.',
  },
];

const ROOMS: AcademicModuleLink[] = [
  {
    href: RESOURCE_ROUTES.roomTypes,
    label: 'Room Types',
    description: 'College-wide room classification vocabulary.',
  },
  {
    href: RESOURCE_ROUTES.roomCapabilities,
    label: 'Room Capabilities',
    description: 'College-wide equipment and feature vocabulary.',
  },
  {
    href: RESOURCE_ROUTES.rooms,
    label: 'Rooms',
    description: 'Department-owned rooms with capacity and sharing scope.',
  },
  {
    href: RESOURCE_ROUTES.roomSharing,
    label: 'Sharing',
    description: 'Grants letting another department use a room.',
  },
  {
    href: RESOURCE_ROUTES.roomCapabilityAssignments,
    label: 'Capability Assignments',
    description: 'Capabilities a room provides.',
  },
  {
    href: RESOURCE_ROUTES.roomAvailability,
    label: 'Availability',
    description: 'Hard weekly availability windows per room.',
  },
  {
    href: RESOURCE_ROUTES.roomRequirements,
    label: 'Teaching Requirements',
    description: 'Room type and capacity a teaching component needs.',
  },
  {
    href: RESOURCE_ROUTES.roomRequirementCapabilities,
    label: 'Required Capabilities',
    description: 'Capabilities a component’s room must provide.',
  },
];

const CALENDAR: AcademicModuleLink[] = [
  {
    href: RESOURCE_ROUTES.workingDays,
    label: 'Working Days',
    description: 'Schedulable weekdays with their opening hours.',
  },
  {
    href: RESOURCE_ROUTES.timeSlots,
    label: 'Time Slots',
    description: 'Teaching periods inside a working day.',
  },
  {
    href: RESOURCE_ROUTES.breakPeriods,
    label: 'Breaks',
    description: 'Explicit breaks inside a working day.',
  },
  {
    href: RESOURCE_ROUTES.calendarExceptions,
    label: 'Calendar Exceptions',
    description: 'Dated holidays, exams, closures and absences.',
  },
];

export default function ResourcesPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        title="Resources"
        description="Instructors, rooms and the calendar configuration the college schedules against. Nothing here is deleted: records are retired with Deactivate, and relationship rows are edited rather than removed."
      />
      <AcademicModuleGroup title="Instructors" links={INSTRUCTORS} />
      <AcademicModuleGroup title="Rooms" links={ROOMS} />
      <AcademicModuleGroup title="Calendar" links={CALENDAR} />
    </div>
  );
}
