import type { Metadata } from 'next';

import { RoomCapabilityAssignmentsScreen } from '@/components/resources/screens/room-capability-assignments-screen';

export const metadata: Metadata = {
  title: 'Room Capability Assignments',
};

export default function RoomCapabilityAssignmentsPage() {
  return <RoomCapabilityAssignmentsScreen />;
}
