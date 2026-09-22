import type { Metadata } from 'next';

import { BreakPeriodsScreen } from '@/components/resources/screens/break-periods-screen';

export const metadata: Metadata = {
  title: 'Breaks',
};

export default function BreakPeriodsPage() {
  return <BreakPeriodsScreen />;
}
