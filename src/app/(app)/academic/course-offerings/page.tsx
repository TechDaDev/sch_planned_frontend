import type { Metadata } from 'next';

import { CourseOfferingsScreen } from '@/components/academic/screens/course-offerings-screen';

export const metadata: Metadata = {
  title: 'Course Offerings',
};

export default function CourseOfferingsPage() {
  return <CourseOfferingsScreen />;
}
