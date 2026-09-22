import type { Metadata } from 'next';

import { RoomTypesScreen } from '@/components/resources/screens/room-types-screen';

export const metadata: Metadata = {
  title: 'Room Types',
};

export default function RoomTypesPage() {
  return <RoomTypesScreen />;
}
