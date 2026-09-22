import type { Metadata } from 'next';

import { InstructorsScreen } from '@/components/resources/screens/instructors-screen';

export const metadata: Metadata = {
  title: 'Instructor Profiles',
};

export default function InstructorsPage() {
  return <InstructorsScreen />;
}
