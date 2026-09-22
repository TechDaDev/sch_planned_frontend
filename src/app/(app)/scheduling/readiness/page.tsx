import type { Metadata } from 'next';

import { ReadinessScreen } from '@/components/scheduling/screens/readiness-screen';

export const metadata: Metadata = {
  title: 'Scheduling Readiness',
};

export default function ReadinessPage() {
  return <ReadinessScreen />;
}
