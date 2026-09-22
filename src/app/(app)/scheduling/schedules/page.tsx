import type { Metadata } from 'next';

import { SchedulesScreen } from '@/components/scheduling/screens/schedules-screen';

export const metadata: Metadata = {
  title: 'Schedule History',
};

export default function SchedulesPage() {
  return <SchedulesScreen />;
}
