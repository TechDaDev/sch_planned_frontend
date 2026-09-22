import type { Metadata } from 'next';

import { CollegesScreen } from '@/components/academic/screens/colleges-screen';

export const metadata: Metadata = {
  title: 'Colleges',
};

export default function CollegesPage() {
  return <CollegesScreen />;
}
