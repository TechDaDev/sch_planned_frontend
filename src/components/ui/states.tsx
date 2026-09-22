import * as React from 'react';

import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

export interface RestrictedStateProps {
  title: string;
  description: string;
  detail?: React.ReactNode;
  className?: string;
}

/** Stable "you cannot use this here" panel (403, missing department, ...). */
export function RestrictedState({
  title,
  description,
  detail,
  className,
}: RestrictedStateProps) {
  return (
    <Card className={cn('max-w-2xl', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-muted-foreground">{description}</p>
        {detail ? <div className="mt-3 text-sm">{detail}</div> : null}
      </CardBody>
    </Card>
  );
}

export interface ModulePlaceholderProps {
  title: string;
  description: string;
  phase: 'F1' | 'F2' | 'F3' | 'F4';
}

/**
 * Placeholder for a domain destination that belongs to a later frontend phase.
 *
 * Deliberately contains no invented tables, counts or schedule data.
 */
export function ModulePlaceholder({ title, description, phase }: ModulePlaceholderProps) {
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2">
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-sm">
          This module will be implemented in Frontend {phase}.
        </p>
      </CardBody>
    </Card>
  );
}
