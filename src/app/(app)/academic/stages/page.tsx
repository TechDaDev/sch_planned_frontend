import type { Metadata } from 'next';

import { StagesScreen } from '@/components/academic/screens/stages-screen';

export const metadata: Metadata = {
  title: 'Study Stages',
};

export default function StagesPage() {
  return <StagesScreen />;
}
