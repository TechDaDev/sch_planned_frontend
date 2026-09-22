import type { Metadata } from 'next';

import { SemestersScreen } from '@/components/academic/screens/semesters-screen';

export const metadata: Metadata = {
  title: 'Semesters',
};

export default function SemestersPage() {
  return <SemestersScreen />;
}
