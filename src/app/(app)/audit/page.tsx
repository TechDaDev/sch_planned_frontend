import type { Metadata } from 'next';

import { AuditScreen } from '@/components/audit/audit-screens';

export const metadata: Metadata = {
  title: 'Audit Trail',
};

export default function AuditPage() {
  return <AuditScreen />;
}
