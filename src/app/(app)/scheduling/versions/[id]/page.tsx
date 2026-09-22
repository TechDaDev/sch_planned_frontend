import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { VersionDetailScreen } from '@/components/scheduling/screens/version-detail-screen';

export const metadata: Metadata = {
  title: 'Schedule Version',
};

/** Route params arrive as strings; a non-numeric id cannot address a version. */
function parseId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function VersionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const versionId = parseId(id);
  if (versionId === null) {
    notFound();
  }
  return <VersionDetailScreen versionId={versionId} />;
}
