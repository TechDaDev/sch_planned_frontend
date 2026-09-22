import type { Metadata } from 'next';

import { PublishedReportScreen } from '@/components/scheduling/reports-screens';

export const metadata: Metadata = {
  title: 'Published Report',
};

export default function PublishedReportPage() {
  return <PublishedReportScreen />;
}
