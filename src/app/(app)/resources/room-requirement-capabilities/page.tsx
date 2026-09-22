import type { Metadata } from 'next';

import { RoomRequirementCapabilitiesScreen } from '@/components/resources/screens/room-requirement-capabilities-screen';

export const metadata: Metadata = {
  title: 'Required Capabilities',
};

export default function RoomRequirementCapabilitiesPage() {
  return <RoomRequirementCapabilitiesScreen />;
}
