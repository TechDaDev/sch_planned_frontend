import type { Metadata } from 'next';

import { ReportsLandingScreen } from '@/components/scheduling/reports-screens';

export const metadata: Metadata = {
  title: 'Reports',
};

export default function ReportsPage() {
  return <ReportsLandingScreen />;
}
