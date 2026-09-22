import type { Metadata } from 'next';

import {
  AcademicModuleGroup,
  type AcademicModuleLink,
} from '@/components/academic/module-card';
import { Card, CardBody } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RESOURCE_ROUTES } from '@/lib/resources/constants';

export const metadata: Metadata = {
  title: 'Calendar Configuration',
};

const RECURRING_GRID: AcademicModuleLink[] = [
  {
    href: RESOURCE_ROUTES.workingDays,
    label: 'Working Days',
    description: 'One row per semester and weekday, with its opening hours.',
  },
  {
    href: RESOURCE_ROUTES.timeSlots,
    label: 'Time Slots',
    description: 'Teaching periods that must fit inside their working day.',
  },
  {
    href: RESOURCE_ROUTES.breakPeriods,
    label: 'Breaks',
    description: 'Breaks that must not overlap an active teaching period.',
  },
];

const DATED_EXCEPTIONS: AcademicModuleLink[] = [
  {
    href: RESOURCE_ROUTES.calendarExceptions,
    label: 'Calendar Exceptions',
    description: 'Holidays, exams, events, maintenance, absences and closures.',
  },
];

export default function CalendarConfigurationPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        title="Calendar Configuration"
        description="The college calendar has two distinct halves: a recurring weekly grid that repeats every week of a semester, and dated exceptions that override it on a single day."
      />

      <Card className="max-w-3xl">
        <CardBody className="space-y-2 text-sm">
          <p className="font-medium">Recurring weekly grid</p>
          <p className="text-muted-foreground">
            Working days, time slots and breaks repeat for every week of the
            semester. A weekday without a working day row is simply not
            schedulable; durations may vary, and no fixed period length is assumed.
          </p>
          <p className="font-medium">Dated exceptions</p>
          <p className="text-muted-foreground">
            Exceptions apply to one date and may be full-day or partial-day. They
            concern the whole college, one department, one instructor, one room or
            one student group.
          </p>
        </CardBody>
      </Card>

      <AcademicModuleGroup title="Recurring Weekly Grid" links={RECURRING_GRID} />
      <AcademicModuleGroup title="Dated Exceptions" links={DATED_EXCEPTIONS} />
    </div>
  );
}
