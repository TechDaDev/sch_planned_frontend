import type { Metadata } from 'next';

import { ProgramsScreen } from '@/components/academic/screens/programs-screen';

export const metadata: Metadata = {
  title: 'Study Programs',
};

export default function ProgramsPage() {
  return <ProgramsScreen />;
}
