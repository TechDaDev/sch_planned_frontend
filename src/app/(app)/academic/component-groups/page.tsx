import type { Metadata } from 'next';

import { ComponentGroupsScreen } from '@/components/academic/screens/component-groups-screen';

export const metadata: Metadata = {
  title: 'Component Groups',
};

export default function ComponentGroupsPage() {
  return <ComponentGroupsScreen />;
}
