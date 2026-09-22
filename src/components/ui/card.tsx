import * as React from 'react';

import { cn } from '@/lib/utils/cn';

export function Card({ className, ...rest }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('rounded-lg border border-line bg-surface shadow-sm', className)}
      {...rest}
    />
  );
}

export function CardHeader({ className, ...rest }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('border-b border-line px-5 py-4', className)} {...rest} />;
}

export function CardBody({ className, ...rest }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('px-5 py-4', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('border-t border-line px-5 py-4', className)} {...rest} />
  );
}

export function CardTitle({ className, ...rest }: React.ComponentPropsWithoutRef<'h2'>) {
  return <h2 className={cn('text-base font-semibold', className)} {...rest} />;
}

export function CardDescription({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<'p'>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...rest} />;
}
