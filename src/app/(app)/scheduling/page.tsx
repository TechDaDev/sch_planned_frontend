import type { Metadata } from 'next';

import { SchedulingLandingScreen } from '@/components/scheduling/screens/scheduling-landing-screen';
import { PageHeading } from '@/components/ui/page-heading';

export const metadata: Metadata = {
  title: 'Scheduling',
};

export default function SchedulingPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Scheduling"
        description="Validate readiness, generate previews, store draft versions and inspect the resulting timetables."
      />
      <SchedulingLandingScreen />
    </div>
  );
}
