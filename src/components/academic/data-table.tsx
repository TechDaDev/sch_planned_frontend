'use client';

import * as React from 'react';

import { cn } from '@/lib/utils/cn';

export type ColumnPriority = 'primary' | 'secondary';

export interface ColumnSpec<TItem> {
  key: string;
  header: string;
  render: (item: TItem) => React.ReactNode;
  /**
   * `secondary` columns are hidden on narrow screens so a wide academic table
   * degrades predictably; the data stays reachable through the record's detail
   * columns and the edit form.
   */
  priority?: ColumnPriority;
  className?: string;
}

export interface DataTableProps<TItem> {
  columns: readonly ColumnSpec<TItem>[];
  items: readonly TItem[];
  getRowKey: (item: TItem) => number;
  /** Accessible name of the table, rendered as a screen-reader caption. */
  caption: string;
  /** Rendered inside the last cell of every row. */
  renderRowActions?: (item: TItem) => React.ReactNode;
  actionsHeader?: string;
}

/**
 * Academic table.
 *
 * Wide tables scroll horizontally instead of overflowing the viewport, and every
 * header is a real column header so assistive technology can navigate it.
 */
export function DataTable<TItem>({
  columns,
  items,
  getRowKey,
  caption,
  renderRowActions,
  actionsHeader = 'Actions',
}: DataTableProps<TItem>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-3 py-2 font-medium text-muted-foreground',
                  column.priority === 'secondary' ? 'hidden md:table-cell' : undefined,
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
            {renderRowActions ? (
              <th scope="col" className="px-3 py-2 text-right font-medium text-muted-foreground">
                {actionsHeader}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={getRowKey(item)} className="border-b border-line last:border-0 align-top">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-3 py-2',
                    column.priority === 'secondary' ? 'hidden md:table-cell' : undefined,
                    column.className,
                  )}
                >
                  {column.render(item)}
                </td>
              ))}
              {renderRowActions ? (
                <td className="px-3 py-2 text-right">{renderRowActions(item)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
