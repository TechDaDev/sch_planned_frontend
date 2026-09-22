import type { Metadata } from 'next';

import { PageHeading } from '@/components/ui/page-heading';
import { ModulePlaceholder } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'Scheduling',
};

export default function SchedulingPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Scheduling"
        description="Timetable generation runs and manual timetable editing."
      />
      <ModulePlaceholder
        phase="F3"
        title="Scheduling workspace"
        description="Start generation runs, review candidate timetables and adjust sessions manually."
      />
    </div>
  );
}
