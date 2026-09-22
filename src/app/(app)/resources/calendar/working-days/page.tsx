import type { Metadata } from 'next';

import { WorkingDaysScreen } from '@/components/resources/screens/working-days-screen';

export const metadata: Metadata = {
  title: 'Working Days',
};

export default function WorkingDaysPage() {
  return <WorkingDaysScreen />;
}
