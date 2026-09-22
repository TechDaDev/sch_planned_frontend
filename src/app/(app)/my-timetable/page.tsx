import type { Metadata } from 'next';

import { PageHeading } from '@/components/ui/page-heading';
import { ModulePlaceholder } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'My Timetable',
};

export default function MyTimetablePage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="My Timetable"
        description="Your personal teaching timetable."
      />
      <ModulePlaceholder
        phase="F3"
        title="Personal timetable"
        description="Read your published teaching sessions, week by week."
      />
    </div>
  );
}
