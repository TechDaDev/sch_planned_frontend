import type { Metadata } from 'next';

import { StudentGroupsScreen } from '@/components/academic/screens/student-groups-screen';

export const metadata: Metadata = {
  title: 'Student Groups',
};

export default function StudentGroupsPage() {
  return <StudentGroupsScreen />;
}
