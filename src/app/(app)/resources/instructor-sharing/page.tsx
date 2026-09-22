import type { Metadata } from 'next';

import { InstructorSharingScreen } from '@/components/resources/screens/instructor-sharing-screen';

export const metadata: Metadata = {
  title: 'Instructor Sharing',
};

export default function InstructorSharingPage() {
  return <InstructorSharingScreen />;
}
