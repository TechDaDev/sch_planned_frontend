import type { Metadata } from 'next';

import { RoomsScreen } from '@/components/resources/screens/rooms-screen';

export const metadata: Metadata = {
  title: 'Rooms',
};

export default function RoomsPage() {
  return <RoomsScreen />;
}
