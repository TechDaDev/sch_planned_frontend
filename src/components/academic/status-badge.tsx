import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { rowAccessLabel, type RowAccessBadge } from '@/lib/academic/permissions';

/**
 * Lifecycle badge.
 *
 * The label carries the meaning, so status is never communicated by color alone.
 */
export function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge tone={isActive ? 'success' : 'neutral'}>
      {isActive ? 'Active' : 'Inactive'}
    </Badge>
  );
}

export interface RowAccessBadgeViewProps {
  badge: RowAccessBadge | null;
  className?: string;
}

/**
 * Read-only annotation for rows that are visible but not manageable, such as a
 * joint course or an offering managed by another department.
 */
export function RowAccessBadgeView({ badge, className }: RowAccessBadgeViewProps) {
  if (badge === null) {
    return null;
  }
  const tone = badge === 'read-only' ? 'neutral' : 'info';
  return (
    <Badge tone={tone} className={cn(className)}>
      <span className="sr-only">Row access: </span>
      {rowAccessLabel(badge)}
    </Badge>
  );
}
