import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { VersionReportScreen } from '@/components/scheduling/reports-screens';

export const metadata: Metadata = {
  title: 'Version Report',
};

/** Route params arrive as strings; a non-numeric id cannot address a version. */
function parseId(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default async function VersionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const versionId = parseId(id);
  if (versionId === null) {
    notFound();
  }
  return <VersionReportScreen versionId={versionId} />;
}
