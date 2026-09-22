import * as React from 'react';

import { cn } from '@/lib/utils/cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<AlertTone, string> = {
  info: 'border-line bg-surface-muted text-foreground',
  success: 'border-success/40 bg-success-surface text-foreground',
  warning: 'border-warning/40 bg-warning-surface text-foreground',
  danger: 'border-danger/40 bg-danger-surface text-foreground',
};

export interface AlertProps extends React.ComponentPropsWithoutRef<'div'> {
  tone?: AlertTone;
  title?: string;
}

/**
 * Inline message block.
 *
 * Error states use `role="alert"` plus a text label, so a failure is never
 * communicated by color alone.
 */
export function Alert({
  tone = 'info',
  title,
  className,
  children,
  ...rest
}: AlertProps) {
  const isUrgent = tone === 'danger' || tone === 'warning';
  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      className={cn('rounded-md border px-4 py-3 text-sm', TONE_CLASSES[tone], className)}
      {...rest}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title ? 'mt-1' : undefined)}>{children}</div> : null}
    </div>
  );
}
