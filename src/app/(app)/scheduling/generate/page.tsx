import type { Metadata } from 'next';

import { GenerateScreen } from '@/components/scheduling/screens/generate-screen';

export const metadata: Metadata = {
  title: 'Generate Timetable',
};

export default function GeneratePage() {
  return <GenerateScreen />;
}
