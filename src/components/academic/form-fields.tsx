'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import type { FieldOption, FormFieldSpec } from '@/lib/academic/forms';

export interface FieldControlProps {
  field: FormFieldSpec;
  value: string;
  error?: string;
  onChange: (name: string, value: string) => void;
  idPrefix: string;
}

function describedBy(
  id: string,
  error: string | undefined,
  helpText: string | undefined,
): string | undefined {
  const ids = [error ? `${id}-error` : null, helpText ? `${id}-help` : null].filter(
    (value): value is string => value !== null,
  );
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function SelectControl({
  field,
  value,
  error,
  onChange,
  idPrefix,
}: FieldControlProps): React.ReactElement {
  const id = `${idPrefix}-${field.name}`;
  const options: readonly FieldOption[] = field.options ?? [];
  return (
    <select
      id={id}
      name={field.name}
      value={value}
      disabled={field.locked}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, error, field.helpText ?? field.lockedReason)}
      onChange={(event) => onChange(field.name, event.target.value)}
      className={cn(
        'h-10 w-full rounded-md border bg-surface px-3 text-sm',
        'disabled:cursor-not-allowed disabled:opacity-70',
        error ? 'border-danger' : 'border-line',
      )}
    >
      <option value="">Select…</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * One labelled form control.
 *
 * The label is always associated with the control, errors are linked through
 * `aria-describedby`, and locked controls explain why they cannot be changed.
 */
export function FieldControl(props: FieldControlProps): React.ReactElement {
  const { field, value, error, onChange, idPrefix } = props;
  const id = `${idPrefix}-${field.name}`;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const description = field.helpText ?? field.lockedReason;

  if (field.kind === 'checkbox') {
    return (
      <div>
        <div className="flex items-center gap-2">
          <input
            id={id}
            name={field.name}
            type="checkbox"
            checked={value === 'true'}
            onChange={(event) => onChange(field.name, String(event.target.checked))}
            aria-describedby={description ? helpId : undefined}
            className="size-4 rounded border-line"
          />
          <label htmlFor={id} className="text-sm font-medium">
            {field.label}
          </label>
        </div>
        {description ? (
          <p id={helpId} className="mt-1 text-xs text-muted-foreground">
            {description}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="mt-1 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {field.label}
        {field.required ? (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
        {field.required ? <span className="sr-only"> (required)</span> : null}
      </label>

      <div className="mt-1">
        {field.kind === 'select' ? (
          <SelectControl {...props} />
        ) : field.kind === 'textarea' ? (
          <textarea
            id={id}
            name={field.name}
            value={value}
            rows={3}
            placeholder={field.placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, error, description)}
            onChange={(event) => onChange(field.name, event.target.value)}
            className={cn(
              'w-full rounded-md border bg-surface px-3 py-2 text-sm',
              error ? 'border-danger' : 'border-line',
            )}
          />
        ) : (
          <Input
            id={id}
            name={field.name}
            type={field.kind === 'date' ? 'date' : 'text'}
            inputMode={
              field.kind === 'integer'
                ? 'numeric'
                : field.kind === 'decimal'
                  ? 'decimal'
                  : undefined
            }
            value={value}
            placeholder={field.placeholder}
            autoComplete={field.autoComplete}
            invalid={Boolean(error)}
            aria-describedby={describedBy(id, error, description)}
            onChange={(event) => onChange(field.name, event.target.value)}
          />
        )}
      </div>

      {description ? (
        <p id={helpId} className="mt-1 text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
