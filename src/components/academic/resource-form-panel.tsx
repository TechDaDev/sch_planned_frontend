'use client';

import * as React from 'react';

import { FieldControl } from '@/components/academic/form-fields';
import { useToast } from '@/components/providers/toast-provider';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiClientError, type ApiError } from '@/lib/api/errors';
import type { FormFieldSpec, FormValues } from '@/lib/academic/forms';

export interface ResourceFormPanelProps<TWrite extends object> {
  open: boolean;
  mode: 'create' | 'edit';
  /** Singular entity label, e.g. `Study program`. */
  entityLabel: string;
  fields: readonly FormFieldSpec[];
  initialValues: FormValues;
  toPayload: (values: FormValues) => TWrite;
  onSubmit: (payload: TWrite) => Promise<unknown>;
  onSaved: (summary: string) => void;
  onClose: () => void;
  /** Applied when a field changes and derives other values (e.g. end year). */
  deriveValues?: (name: string, value: string, values: FormValues) => FormValues | null;
  /** Fields whose option lists depend on other values in the form. */
  resolveField?: (field: FormFieldSpec, values: FormValues) => FormFieldSpec;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

/**
 * Create/edit panel for academic records.
 *
 * Behaviour shared by every academic form lives here: client validation, DRF
 * field error placement, non-field error summary, saving state and keyboard
 * handling. A failed submit always leaves the panel open with the user's input
 * intact.
 */
export function ResourceFormPanel<TWrite extends object>({
  open,
  mode,
  entityLabel,
  fields,
  initialValues,
  toPayload,
  onSubmit,
  onSaved,
  onClose,
  deriveValues,
  resolveField,
}: ResourceFormPanelProps<TWrite>) {
  const { notify } = useToast();
  const [values, setValues] = React.useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<ApiError | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const titleId = React.useId();
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const previouslyFocused = React.useRef<Element | null>(null);

  // Reset the form whenever the panel is (re)opened for a different record.
  // The initial values are read through a ref so a parent re-render (which
  // recreates the object) can never wipe what the user is typing.
  const initialValuesRef = React.useRef(initialValues);
  React.useEffect(() => {
    initialValuesRef.current = initialValues;
  }, [initialValues]);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setValues(initialValuesRef.current);
    setFieldErrors({});
    setFormError(null);
    setIsSaving(false);
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      previouslyFocused.current = null;
      return;
    }
    previouslyFocused.current = document.activeElement;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => {
      const previous = previouslyFocused.current;
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [open]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const container = panelRef.current;
      if (!container) {
        return;
      }
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) {
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) {
    return null;
  }

  const resolvedFields = fields.map((field) =>
    resolveField ? resolveField(field, values) : field,
  );
  const visibleFields = resolvedFields.filter(
    (field) => field.visible === undefined || field.visible(values),
  );

  const handleChange = (name: string, value: string) => {
    setFieldErrors((current) => {
      if (current[name] === undefined) {
        return current;
      }
      const next = { ...current };
      delete next[name];
      return next;
    });
    setValues((current) => {
      const base: FormValues = { ...current, [name]: value };
      const derived = deriveValues ? deriveValues(name, value, base) : null;
      return derived ?? base;
    });
  };

  const validateClientSide = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    for (const field of visibleFields) {
      if (!field.validate) {
        continue;
      }
      const message = field.validate(values[field.name] ?? '', values);
      if (message) {
        errors[field.name] = message;
      }
    }
    return errors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    const clientErrors = validateClientSide();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setFormError(null);
      const firstInvalid = visibleFields.find((field) => clientErrors[field.name] !== undefined);
      if (firstInvalid) {
        panelRef.current
          ?.querySelector<HTMLElement>(
            `input[name="${firstInvalid.name}"], select[name="${firstInvalid.name}"], textarea[name="${firstInvalid.name}"]`,
          )
          ?.focus();
      }
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await onSubmit(toPayload(values));
      onSaved(mode === 'create' ? `${entityLabel} created.` : `${entityLabel} updated.`);
    } catch (cause: unknown) {
      if (cause instanceof ApiClientError) {
        const apiError = cause.toApiError();
        const knownNames = new Set(resolvedFields.map((field) => field.name));
        const inline: Record<string, string> = {};
        const unassigned: Record<string, string[]> = {};
        for (const [name, messages] of Object.entries(apiError.fieldErrors ?? {})) {
          const message = messages.join(' ');
          if (name !== 'non_field_errors' && knownNames.has(name)) {
            inline[name] = message;
          } else {
            unassigned[name] = messages;
          }
        }
        setFieldErrors(inline);
        setFormError({ ...apiError, fieldErrors: unassigned });
        notify({
          tone: 'danger',
          title: `${entityLabel} was not saved`,
          description: apiError.detail,
        });
      } else {
        setFormError({
          status: 0,
          detail: 'The request could not be completed. Please try again.',
        });
        notify({
          tone: 'danger',
          title: `${entityLabel} was not saved`,
          description: 'The request could not be completed. Please try again.',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const unassignedErrors = formError?.fieldErrors
    ? Object.entries(formError.fieldErrors)
    : [];

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className="w-full max-w-2xl rounded-lg border border-line bg-surface shadow-lg"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">
            {mode === 'create' ? `Create ${entityLabel.toLowerCase()}` : `Edit ${entityLabel.toLowerCase()}`}
          </h2>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-5 py-4">
            {formError ? (
              <Alert tone="danger" title={formError.detail}>
                {unassignedErrors.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5">
                    {unassignedErrors.map(([name, messages]) => (
                      <li key={name}>
                        <span className="font-medium">
                          {name === 'non_field_errors' ? 'Not accepted' : name}:
                        </span>{' '}
                        <span>{messages.join(' ')}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Alert>
            ) : null}

            {visibleFields.map((field) => (
              <FieldControl
                key={field.name}
                field={field}
                value={values[field.name] ?? ''}
                error={fieldErrors[field.name]}
                onChange={handleChange}
                idPrefix={titleId}
              />
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
