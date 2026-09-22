import type { Metadata } from 'next';

import { AuditDetailScreen } from '@/components/audit/audit-screens';

export const metadata: Metadata = {
  title: 'Audit Event',
};

/**
 * Audit event ids are UUID strings, so the param is passed through unchanged: a
 * malformed value simply produces the backend's not-found answer.
 */
export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AuditDetailScreen eventId={id} />;
}
