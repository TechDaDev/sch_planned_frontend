import type { Metadata } from 'next';

import { TimeSlotsScreen } from '@/components/resources/screens/time-slots-screen';

export const metadata: Metadata = {
  title: 'Time Slots',
};

export default function TimeSlotsPage() {
  return <TimeSlotsScreen />;
}
