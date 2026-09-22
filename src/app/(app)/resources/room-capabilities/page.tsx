import type { Metadata } from 'next';

import { RoomCapabilitiesScreen } from '@/components/resources/screens/room-capabilities-screen';

export const metadata: Metadata = {
  title: 'Room Capabilities',
};

export default function RoomCapabilitiesPage() {
  return <RoomCapabilitiesScreen />;
}
