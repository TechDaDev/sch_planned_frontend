import type { Metadata } from 'next';

import { TeachingComponentsScreen } from '@/components/academic/screens/teaching-components-screen';

export const metadata: Metadata = {
  title: 'Teaching Components',
};

export default function TeachingComponentsPage() {
  return <TeachingComponentsScreen />;
}
