import type { Metadata } from 'next';

import { PublishedTimetableScreen } from '@/components/scheduling/published-timetable-screen';

export const metadata: Metadata = {
  title: 'My Timetable',
};

/**
 * The instructor's own teaching timetable.
 *
 * It reads the same published endpoint as the official timetable with an explicit
 * instructor scope, so an instructor never sees a group, room or department view of
 * the semester, and never sees a draft.
 */
export default function MyTimetablePage() {
  return <PublishedTimetableScreen instructorView />;
}
