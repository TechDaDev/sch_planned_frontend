import type { Metadata } from 'next';

import { PageHeading } from '@/components/ui/page-heading';
import { ModulePlaceholder } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'Reports',
};

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Reports"
        description="Operational reports, analytics and exports."
      />
      <ModulePlaceholder
        phase="F4"
        title="Reports and exports"
        description="Browse operational reports and download Excel/PDF exports."
      />
    </div>
  );
}
