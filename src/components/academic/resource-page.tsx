'use client';

import * as React from 'react';

import { ConfirmDialog } from '@/components/academic/confirm-dialog';
import { DataTable, type ColumnSpec } from '@/components/academic/data-table';
import { ResourceFormPanel } from '@/components/academic/resource-form-panel';
import { RowAccessBadgeView } from '@/components/academic/status-badge';
import { useToast } from '@/components/providers/toast-provider';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeading } from '@/components/ui/page-heading';
import { Skeleton } from '@/components/ui/spinner';
import { ApiClientError } from '@/lib/api/errors';
import { DEACTIVATION_NOTICE } from '@/lib/academic/constants';
import type { FormFieldSpec, FormValues } from '@/lib/academic/forms';
import { rowAccessLabel, type RowAccessBadge } from '@/lib/academic/permissions';
import { useCollection } from '@/lib/academic/use-collection';
import { cn } from '@/lib/utils/cn';

/** What the current user may do with one row. */
export interface RowAccess {
  manageable: boolean;
  /** Set when the row is visible but read-only (joint / external manager). */
  badge: RowAccessBadge | null;
}

export interface AcademicResourcePageProps<TRead, TWrite extends object> {
  title: string;
  description: string;
  /** Singular label, e.g. `Study program`. */
  entityLabel: string;
  /** Plural label used in empty and loading copy, e.g. `study programs`. */
  entityPlural: string;
  load: (signal: AbortSignal) => Promise<TRead[]>;
  columns: readonly ColumnSpec<TRead>[];
  getRowKey: (item: TRead) => number;
  getRowLabel: (item: TRead) => string;
  /** Text used by the local (client-side) search. */
  searchText: (item: TRead) => string;
  hasStatus: boolean;
  getIsActive?: (item: TRead) => boolean;
  getRowAccess: (item: TRead) => RowAccess;
  createAccess: { allowed: boolean; reason?: string };
  createFields: readonly FormFieldSpec[];
  editFields: (item: TRead) => readonly FormFieldSpec[];
  createFormValues: () => FormValues;
  editFormValues: (item: TRead) => FormValues;
  toPayload: (values: FormValues) => TWrite;
  onCreate: (payload: TWrite) => Promise<unknown>;
  onUpdate: (id: number, payload: Partial<TWrite>) => Promise<unknown>;
  deriveValues?: (name: string, value: string, values: FormValues) => FormValues | null;
  /**
   * Adjust a field for the current form state, with access to the loaded rows
   * and the record being edited (for example parent-group options).
   */
  resolveField?: (
    field: FormFieldSpec,
    values: FormValues,
    context: { items: readonly TRead[]; editingItem: TRead | null },
  ) => FormFieldSpec;
  /** Refresh reference collections owned by the page after a mutation. */
  onMutated?: () => void;
  /** The form needs reference data that is still loading. */
  isReferenceLoading?: boolean;
  searchPlaceholder?: string;
  /** Extra toolbar controls (for example a stage filter). */
  toolbarExtra?: React.ReactNode;
}

type FormMode = 'create' | 'edit';

/**
 * Generic academic list page.
 *
 * All eleven academic entities use this component, so loading, empty, error,
 * search, status filtering, capability checks, deactivation confirmation and
 * post-mutation refresh behave identically everywhere.
 */
export function AcademicResourcePage<TRead, TWrite extends object>(
  props: AcademicResourcePageProps<TRead, TWrite>,
) {
  const {
    title,
    description,
    entityLabel,
    entityPlural,
    load,
    columns,
    getRowKey,
    getRowLabel,
    searchText,
    hasStatus,
    getIsActive,
    getRowAccess,
    createAccess,
    createFields,
    editFields,
    createFormValues,
    editFormValues,
    toPayload,
    onCreate,
    onUpdate,
    deriveValues,
    resolveField,
    onMutated,
    isReferenceLoading = false,
    searchPlaceholder,
    toolbarExtra,
  } = props;

  const { notify } = useToast();
  const collection = useCollection(load);

  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'inactive'>('all');
  const [formMode, setFormMode] = React.useState<FormMode | null>(null);
  const [editingItem, setEditingItem] = React.useState<TRead | null>(null);
  const [pendingDeactivation, setPendingDeactivation] = React.useState<TRead | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  const filteredItems = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return collection.items.filter((item) => {
      if (needle.length > 0 && !searchText(item).toLowerCase().includes(needle)) {
        return false;
      }
      if (hasStatus && statusFilter !== 'all' && getIsActive) {
        const isActive = getIsActive(item);
        if (statusFilter === 'active' && !isActive) {
          return false;
        }
        if (statusFilter === 'inactive' && isActive) {
          return false;
        }
      }
      return true;
    });
  }, [collection.items, search, searchText, hasStatus, statusFilter, getIsActive]);

  const openCreate = () => {
    setEditingItem(null);
    setFormMode('create');
  };

  const openEdit = (item: TRead) => {
    setEditingItem(item);
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingItem(null);
  };

  const afterMutation = (message: string) => {
    notify({ tone: 'success', title: message });
    collection.reload();
    onMutated?.();
  };

  const handleStatusChange = async (item: TRead, next: boolean) => {
    setIsBusy(true);
    try {
      // The status patch is the only field sent, so it is a safe partial.
      await onUpdate(getRowKey(item), { is_active: next } as unknown as Partial<TWrite>);
      afterMutation(next ? `${entityLabel} activated.` : `${entityLabel} deactivated.`);
    } catch (cause: unknown) {
      notify({
        tone: 'danger',
        title: `${entityLabel} was not updated`,
        description:
          cause instanceof ApiClientError
            ? cause.toApiError().detail
            : 'The request could not be completed. Please try again.',
      });
    } finally {
      setIsBusy(false);
      setPendingDeactivation(null);
    }
  };

  const fieldsForForm: readonly FormFieldSpec[] =
    formMode === 'create' ? createFields : editingItem ? editFields(editingItem) : [];
  const initialValues: FormValues =
    formMode === 'create' ? createFormValues() : editingItem ? editFormValues(editingItem) : {};

  return (
    <div className="space-y-6">
      <PageHeading
        title={title}
        description={description}
        actions={
          createAccess.allowed ? (
            <Button onClick={openCreate} disabled={isReferenceLoading}>
              New {entityLabel.toLowerCase()}
            </Button>
          ) : createAccess.reason ? (
            <p className="max-w-xs text-sm text-muted-foreground">{createAccess.reason}</p>
          ) : null
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex w-full flex-col gap-3 sm:max-w-md sm:flex-row">
              <div className="w-full">
                <label htmlFor="academic-search" className="block text-sm font-medium">
                  Search {entityPlural}
                </label>
                <Input
                  id="academic-search"
                  type="search"
                  value={search}
                  placeholder={searchPlaceholder ?? 'Search by name or code'}
                  onChange={(event) => setSearch(event.target.value)}
                  className="mt-1"
                />
              </div>
              {hasStatus ? (
                <div className="w-full sm:w-40">
                  <label htmlFor="academic-status" className="block text-sm font-medium">
                    Status
                  </label>
                  <select
                    id="academic-status"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')
                    }
                    className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              ) : null}
            </div>
            {toolbarExtra ? <div className="flex items-end gap-2">{toolbarExtra}</div> : null}
          </div>

          {collection.status === 'loading' ? (
            <div className="space-y-2" aria-live="polite">
              <p className="text-sm text-muted-foreground">Loading {entityPlural}…</p>
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-10 w-full" />
              ))}
            </div>
          ) : collection.status === 'error' ? (
            <Alert tone="danger" title={`${title} could not be loaded`}>
              <div className="space-y-3">
                <p>
                  {collection.error?.detail ??
                    'The server could not be reached. Please try again.'}
                </p>
                <Button variant="secondary" size="sm" onClick={collection.reload}>
                  Retry
                </Button>
              </div>
            </Alert>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-md border border-line bg-surface-muted px-4 py-6 text-sm">
              <p className="font-medium">
                {collection.items.length === 0
                  ? `No ${entityPlural} yet.`
                  : `No ${entityPlural} match the current search or filter.`}
              </p>
              <p className="mt-1 text-muted-foreground">
                {collection.items.length === 0
                  ? createAccess.allowed
                    ? `Create the first record with “New ${entityLabel.toLowerCase()}”.`
                    : 'Nothing is visible for your account yet.'
                  : 'Clear the search or reset the status filter to see more.'}
              </p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              items={filteredItems}
              getRowKey={getRowKey}
              caption={`${title} table`}
              renderRowActions={(item) => {
                const access = getRowAccess(item);
                const label = getRowLabel(item);
                if (!access.manageable) {
                  return (
                    <div className="flex items-center justify-end gap-2">
                      <RowAccessBadgeView badge={access.badge} />
                      {access.badge === null ? (
                        <span className="text-xs text-muted-foreground">Read only</span>
                      ) : null}
                    </div>
                  );
                }
                const isActive = getIsActive ? getIsActive(item) : true;
                return (
                  <div className="flex items-center justify-end gap-2">
                    {access.badge ? <RowAccessBadgeView badge={access.badge} /> : null}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(item)}
                      aria-label={`Edit ${entityLabel.toLowerCase()} ${label}`}
                    >
                      Edit
                    </Button>
                    {hasStatus ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => {
                          if (isActive) {
                            setPendingDeactivation(item);
                          } else {
                            void handleStatusChange(item, true);
                          }
                        }}
                        aria-label={
                          isActive
                            ? `Deactivate ${entityLabel.toLowerCase()} ${label}`
                            : `Activate ${entityLabel.toLowerCase()} ${label}`
                        }
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    ) : null}
                  </div>
                );
              }}
            />
          )}

          {hasStatus && collection.items.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Records are retired with “Deactivate”; there is no delete action.
            </p>
          ) : null}
          {collection.items.some((item) => getRowAccess(item).badge !== null) ? (
            <p className={cn('text-xs text-muted-foreground')}>
              Rows marked{' '}
              {rowAccessLabel('joint')} or {rowAccessLabel('external-manager')} are visible
              because your students take part in them; they are managed by their owning
              department.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <ResourceFormPanel<TWrite>
        open={formMode !== null}
        mode={formMode ?? 'create'}
        entityLabel={entityLabel}
        fields={fieldsForForm}
        initialValues={initialValues}
        toPayload={toPayload}
        onSubmit={async (payload) => {
          if (formMode === 'edit' && editingItem) {
            await onUpdate(getRowKey(editingItem), payload as unknown as Partial<TWrite>);
          } else {
            await onCreate(payload);
          }
        }}
        onSaved={(summary) => {
          closeForm();
          afterMutation(summary);
        }}
        onClose={closeForm}
        deriveValues={deriveValues}
        resolveField={
          resolveField
            ? (field, values) =>
                resolveField(field, values, { items: collection.items, editingItem })
            : undefined
        }
      />

      <ConfirmDialog
        open={pendingDeactivation !== null}
        title={`Deactivate ${entityLabel.toLowerCase()}?`}
        description={`${DEACTIVATION_NOTICE} ${
          pendingDeactivation
            ? `“${getRowLabel(pendingDeactivation)}” stays visible in the list.`
            : ''
        }`}
        confirmLabel="Deactivate"
        isBusy={isBusy}
        onConfirm={() => {
          if (pendingDeactivation) {
            void handleStatusChange(pendingDeactivation, false);
          }
        }}
        onCancel={() => setPendingDeactivation(null)}
      />
    </div>
  );
}
