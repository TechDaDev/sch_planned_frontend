import * as React from 'react';

import { cn } from '@/lib/utils/cn';

export interface InputProps extends React.ComponentPropsWithoutRef<'input'> {
  invalid?: boolean;
}

export function Input({ className, invalid = false, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-md border bg-surface px-3 text-sm',
        'placeholder:text-muted-foreground',
        'disabled:cursor-not-allowed disabled:opacity-60',
        invalid ? 'border-danger' : 'border-line',
        className,
      )}
      {...rest}
    />
  );
}
