import type { Metadata } from 'next';

import { InstructorPreferencesScreen } from '@/components/resources/screens/instructor-preferences-screen';

export const metadata: Metadata = {
  title: 'Instructor Preferences',
};

export default function InstructorPreferencesPage() {
  return <InstructorPreferencesScreen />;
}
