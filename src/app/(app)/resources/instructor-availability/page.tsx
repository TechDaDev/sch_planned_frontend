import type { Metadata } from 'next';

import { InstructorAvailabilityScreen } from '@/components/resources/screens/instructor-availability-screen';

export const metadata: Metadata = {
  title: 'Instructor Availability',
};

export default function InstructorAvailabilityPage() {
  return <InstructorAvailabilityScreen />;
}
