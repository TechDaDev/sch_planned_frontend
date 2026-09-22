import type { Metadata } from 'next';

import { SemesterPlanImportScreen } from '@/components/scheduling/semester-plan-import-screen';

export const metadata: Metadata = {
  title: 'Semester Plan Import',
};

export default function SemesterPlanImportPage() {
  return <SemesterPlanImportScreen />;
}
