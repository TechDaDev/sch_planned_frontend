import type { Metadata } from 'next';

import { RoomRequirementsScreen } from '@/components/resources/screens/room-requirements-screen';

export const metadata: Metadata = {
  title: 'Teaching Requirements',
};

export default function RoomRequirementsPage() {
  return <RoomRequirementsScreen />;
}
