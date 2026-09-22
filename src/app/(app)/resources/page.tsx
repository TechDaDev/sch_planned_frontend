import type { Metadata } from 'next';

import { PageHeading } from '@/components/ui/page-heading';
import { ModulePlaceholder } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'Resources',
};

export default function ResourcesPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Resources"
        description="Rooms, instructors and the teaching resources available for scheduling."
      />
      <ModulePlaceholder
        phase="F2"
        title="Resource management"
        description="Register rooms and instructors, including their availability constraints."
      />
    </div>
  );
}
