import type { Metadata } from 'next';

import { DepartmentsScreen } from '@/components/academic/screens/departments-screen';

export const metadata: Metadata = {
  title: 'Departments',
};

export default function DepartmentsPage() {
  return <DepartmentsScreen />;
}
