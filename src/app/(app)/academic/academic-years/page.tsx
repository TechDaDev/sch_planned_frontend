import type { Metadata } from 'next';

import { AcademicYearsScreen } from '@/components/academic/screens/academic-years-screen';

export const metadata: Metadata = {
  title: 'Academic Years',
};

export default function AcademicYearsPage() {
  return <AcademicYearsScreen />;
}
