import type { Metadata } from 'next';

import { TeachingAssignmentsScreen } from '@/components/resources/screens/teaching-assignments-screen';

export const metadata: Metadata = {
  title: 'Teaching Assignments',
};

export default function TeachingAssignmentsPage() {
  return <TeachingAssignmentsScreen />;
}
