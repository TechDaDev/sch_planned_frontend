import type { Metadata } from 'next';

import { RoomAvailabilityScreen } from '@/components/resources/screens/room-availability-screen';

export const metadata: Metadata = {
  title: 'Room Availability',
};

export default function RoomAvailabilityPage() {
  return <RoomAvailabilityScreen />;
}
