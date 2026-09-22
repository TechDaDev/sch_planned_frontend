import type { Metadata } from 'next';

import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'Forbidden',
};

/**
 * Stable 403 destination.
 *
 * UI-level capability restrictions and backend 403 responses both land here
 * instead of showing a broken page.
 */
export default function ForbiddenPage() {
  return (
    <div className="space-y-6">
      <PageHeading title="Access denied" />
      <RestrictedState
        title="You do not have permission to view this page"
        description="The backend authorization rules decide what your account may access. If you believe you need access, contact a college administrator."
      />
    </div>
  );
}
