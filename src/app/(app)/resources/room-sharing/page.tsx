import type { Metadata } from 'next';

import { RoomSharingScreen } from '@/components/resources/screens/room-sharing-screen';

export const metadata: Metadata = {
  title: 'Room Sharing',
};

export default function RoomSharingPage() {
  return <RoomSharingScreen />;
}
