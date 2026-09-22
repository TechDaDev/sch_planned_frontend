'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation step for state changes that are easy to misread as deletion.
 *
 * Used before deactivation, which never deletes a record.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    if (!open) {
      return;
    }
    containerRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={containerRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          'w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-lg',
        )}
      >
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            isLoading={isBusy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
