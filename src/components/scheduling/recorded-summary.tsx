'use client';

import * as React from 'react';

import { formatMetadataValue } from '@/lib/scheduling/audit';
import { formatSummaryLabel } from '@/lib/scheduling/formatters';

/** Rows shown for a nested collection before the remainder is summarised. */
const MAX_COLLECTION_ROWS = 5;

const LABEL_CLASS = 'text-xs uppercase tracking-wide text-muted-foreground';
const VALUE_CLASS = 'text-sm break-words';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Entries of a summary payload, with the empty ones dropped. */
function summaryEntries(value: unknown): { key: string; value: unknown }[] {
  if (!isPlainObject(value)) {
    return [];
  }
  return Object.entries(value)
    .filter(([, entry]) => entry !== null && entry !== undefined && entry !== '')
    .map(([key, entry]) => ({ key, value: entry }));
}

/**
 * A collection of like objects, shown as a table.
 *
 * The columns come from the union of the keys actually present, so a payload that
 * gains or loses a field does not produce an empty column.
 */
function CollectionTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = Array.from(
    rows.reduce<Set<string>>((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set<string>()),
  );
  const shown = rows.slice(0, MAX_COLLECTION_ROWS);
  const remaining = rows.length - shown.length;

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-line text-left">
              {columns.map((column) => (
                <th key={column} scope="col" className="py-1 pr-3 font-medium">
                  {formatSummaryLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, index) => (
              <tr key={index} className="border-b border-line/50">
                {columns.map((column) => (
                  <td key={column} className="py-1 pr-3 align-top">
                    {formatMetadataValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remaining > 0 ? (
        <p className="text-xs text-muted-foreground">
          {remaining} further {remaining === 1 ? 'row' : 'rows'} are recorded and not shown here.
        </p>
      ) : null}
    </div>
  );
}

/**
 * One recorded value.
 *
 * Scalars become text, a collection becomes a table, and anything deeper keeps the
 * bounded text rendering of the audit viewer rather than dumping a JSON blob at the
 * reader.
 */
function SummaryValue({ value, depth }: { value: unknown; depth: number }) {
  const entries = summaryEntries(value);
  if (entries.length > 0 && depth > 0) {
    return (
      <dl className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.key}>
            <dt className={LABEL_CLASS}>{formatSummaryLabel(entry.key)}</dt>
            <dd className="text-sm">
              <SummaryValue value={entry.value} depth={depth - 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  if (Array.isArray(value)) {
    const objects = value.filter(isPlainObject);
    if (objects.length > 0 && objects.length === value.length) {
      return <CollectionTable rows={objects} />;
    }
    return <span className={VALUE_CLASS}>{formatMetadataValue(value)}</span>;
  }

  return <span className={VALUE_CLASS}>{formatMetadataValue(value)}</span>;
}

export interface RecordedSummaryProps {
  summary: unknown;
  /** Shown when the payload carries nothing to display. */
  emptyLabel?: string;
}

/**
 * A recorded summary payload, rendered for reading.
 *
 * The section exists so a reviewer can see what the engine recorded without
 * decoding raw JSON, so nothing here is presented as an encoded document.
 */
export function RecordedSummary({ summary, emptyLabel = 'Nothing recorded.' }: RecordedSummaryProps) {
  const entries = summaryEntries(summary);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {entries.map((entry) => (
        <div key={entry.key}>
          <dt className={LABEL_CLASS}>{formatSummaryLabel(entry.key)}</dt>
          <dd className="mt-1">
            <SummaryValue value={entry.value} depth={1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
