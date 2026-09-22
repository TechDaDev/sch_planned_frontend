import type { Metadata } from 'next';

import { PublishedTimetableScreen } from '@/components/scheduling/published-timetable-screen';

export const metadata: Metadata = {
  title: 'Official Timetable',
};

export default function PublishedTimetablePage() {
  return <PublishedTimetableScreen />;
}
