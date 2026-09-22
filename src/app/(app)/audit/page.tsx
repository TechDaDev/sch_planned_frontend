import type { Metadata } from 'next';

import { PageHeading } from '@/components/ui/page-heading';
import { ModulePlaceholder } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'Audit',
};

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Audit"
        description="Workflow history and change tracking for this department."
      />
      <ModulePlaceholder
        phase="F4"
        title="Audit viewer"
        description="Inspect workflow transitions and record history. The backend limits results to the departments you may see."
      />
    </div>
  );
}
