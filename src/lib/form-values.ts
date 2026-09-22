/**
 * Value readers shared by the academic and resource form layers.
 *
 * Form state is a flat `Record<string, string>` (that is what form controls
 * produce), so every domain layer needs the same small readers. Keeping them in
 * one place avoids two subtly different interpretations of a blank field.
 */

import { parseDecimalInput } from '@/lib/academic/validation';
import type { DecimalString } from '@/lib/academic/types';

export type FormValues = Record<string, string>;

/** Trimmed text value; a missing key reads as an empty string. */
export function readText(values: FormValues, key: string): string {
  return (values[key] ?? '').trim();
}

export function isBlank(values: FormValues, key: string): boolean {
  return readText(values, key).length === 0;
}

/** Required-field check returning a message or `null`. */
export function requiredText(
  values: FormValues,
  key: string,
  message: string,
): string | null {
  return isBlank(values, key) ? message : null;
}

/** Tri-state checkbox reader: an unset key falls back to `fallback`. */
export function readBoolean(
  values: FormValues,
  key: string,
  fallback: boolean,
): boolean {
  const raw = values[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  return raw === 'true';
}

export function readRequiredId(values: FormValues, key: string): number {
  return Number(readText(values, key));
}

/** Foreign key that may legitimately be absent: blank becomes `null`. */
export function readOptionalId(values: FormValues, key: string): number | null {
  const raw = readText(values, key);
  return raw.length === 0 ? null : Number(raw);
}

/**
 * Decimal field for submission.
 *
 * Returns `null` for blank input so an optional decimal is sent as `null` rather
 * than as zero, and normalizes otherwise (`2` becomes `2.00`).
 */
export function readDecimalOrNull(values: FormValues, key: string): DecimalString | null {
  return parseDecimalInput(readText(values, key));
}

/** Same as `readDecimalOrNull` but falls back to the raw text when unparseable. */
export function readDecimalText(values: FormValues, key: string): string {
  return readDecimalOrNull(values, key) ?? readText(values, key);
}
