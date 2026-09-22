import type { Metadata } from 'next';

import { CompareScreen } from '@/components/scheduling/screens/compare-screen';

export const metadata: Metadata = {
  title: 'Compare Versions',
};

export default function ComparePage() {
  return <CompareScreen />;
}
