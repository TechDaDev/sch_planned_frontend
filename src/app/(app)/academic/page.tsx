import type { Metadata } from 'next';

import { PageHeading } from '@/components/ui/page-heading';
import { ModulePlaceholder } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'Academic Setup',
};

export default function AcademicSetupPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Academic Setup"
        description="Colleges, departments, academic years, study programs, stages, courses and student groups."
      />
      <ModulePlaceholder
        phase="F1"
        title="Academic structure management"
        description="Create and maintain the academic structure this college plans against. Until it exists in the frontend, use the backend admin interface."
      />
    </div>
  );
}
