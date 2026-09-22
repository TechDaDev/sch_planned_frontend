import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ScheduleDetailScreen } from '@/components/scheduling/screens/schedule-detail-screen';

export const metadata: Metadata = {
  title: 'Schedule Detail',
};

/** Route params arrive as strings; a non-numeric id cannot address a schedule. */
function parseId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scheduleId = parseId(id);
  if (scheduleId === null) {
    notFound();
  }
  return <ScheduleDetailScreen scheduleId={scheduleId} />;
}
