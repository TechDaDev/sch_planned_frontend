'use client';

import Link from 'next/link';
import * as React from 'react';

import { useAcademicUser } from '@/components/academic/use-academic-user';
import { IssueList, type IssueRow } from '@/components/scheduling/issue-list';
import { TimetableView } from '@/components/scheduling/timetable-view';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';
import { useCollection } from '@/lib/academic/use-collection';
import { ApiClientError, getApiErrorMessage } from '@/lib/api/errors';
import { scheduleVersionsApi, schedulesApi, manualEditApi } from '@/lib/scheduling/api';
import { timeSlotsApi } from '@/lib/resources/api';
import { roomsApi } from '@/lib/resources/api';
import {
  MANUAL_EDIT_BATCH_NOTICE,
  MANUAL_EDIT_CONTENT_NOTICE,
  MANUAL_EDIT_REJECTION_HELP,
  MANUAL_EDIT_REJECTION_LABELS,
  NEW_VERSION_MESSAGE,
  NOTES_MAX_LENGTH,
  PERSIST_DRAFT_MESSAGE,
  SCHEDULING_ROUTES,
} from '@/lib/scheduling/constants';
import { formatDay, formatRoom, formatTimeRange } from '@/lib/scheduling/formatters';
import {
  buildManualEditRequest,
  checkSlotSelection,
  describePendingChange,
  groupSlotsByWeekday,
  isChangeMeaningful,
  proposalFingerprint,
  removePendingChange,
  selectionMinutes,
  upsertPendingChange,
  type PendingChange,
  type SlotView,
} from '@/lib/scheduling/manual-edit';
import { sessionsFromEntries } from '@/lib/scheduling/normalization';
import {
  canManualEditVersion,
  canReadScheduleHistory,
  isDepartmentlessScopedUser,
} from '@/lib/scheduling/permissions';
import type {
  ManualEditApplyResult,
  ManualEditRejectedResult,
  ManualEditValidationResult,
  ScheduleEntry,
  ScheduleVersionDetail,
  ScheduleVersionSummary,
  TimetableSession,
} from '@/lib/scheduling/types';
import { useResource } from '@/lib/scheduling/use-resource';

function asManualRejection(value: unknown): ManualEditRejectedResult | null {
  return value !== null &&
    typeof value === 'object' &&
    typeof (value as { reason?: unknown }).reason === 'string'
    ? (value as ManualEditRejectedResult)
    : null;
}

function toIssueRows(result: ManualEditValidationResult | null | undefined): IssueRow[] {
  return (result?.issues ?? []).map((issue) => ({
    code: issue.code,
    message: issue.message,
    entryId: issue.entry_id ?? null,
    conflictingEntryId: issue.conflicting_entry_id ?? null,
    details: issue.details,
  }));
}

/** A teaching period as the F2 calendar API returns it. */
interface SlotRecord extends SlotView {
  working_day: { id: number; semester: { id: number } | number; day_of_week: number };
}

interface RoomRecord {
  id: number;
  code: string;
  name: string;
  capacity: number;
  room_type: { id: number; name: string; code: string };
  owner_department: { id: number; name: string; code: string };
  sharing_scope: string;
  is_active: boolean;
}

export interface ManualEditScreenProps {
  versionId: number;
}

/**
 * Validated manual editing of one draft version.
 *
 * The page is a form-first workflow, not a drag interaction: select a session, choose
 * periods and a room, add the change to a pending batch, inspect the whole batch,
 * validate it, and only then apply it. Applying stores a brand-new immutable
 * `MANUAL_EDIT` version; the old version is never modified.
 *
 * Only placement moves. Course, offering, component, instructors, student groups and
 * every snapshot value are excluded from the request by construction.
 */
export function ManualEditScreen({ versionId }: ManualEditScreenProps) {
  const { capability } = useAcademicUser();

  const loadVersion = React.useCallback(
    (signal: AbortSignal) => scheduleVersionsApi.get(versionId, signal),
    [versionId],
  );
  const loadEntries = React.useCallback(
    (signal: AbortSignal) => scheduleVersionsApi.entries(versionId, {}, signal),
    [versionId],
  );
  const loadSlots = React.useCallback((signal: AbortSignal) => timeSlotsApi.list({}, signal), []);
  const loadRooms = React.useCallback((signal: AbortSignal) => roomsApi.list({}, signal), []);

  const versionResource = useResource<ScheduleVersionDetail>(loadVersion);
  const entryCollection = useCollection<ScheduleEntry>(loadEntries);
  const slotCollection = useCollection<SlotRecord>(loadSlots);
  const roomCollection = useCollection<RoomRecord>(loadRooms);

  const version = versionResource.data;
  const entries = entryCollection.items;
  const sessions = React.useMemo(() => sessionsFromEntries(entries), [entries]);

  const scheduleId = version?.schedule.id ?? null;
  const loadHistory = React.useCallback(
    (signal: AbortSignal) =>
      scheduleId === null
        ? Promise.resolve<ScheduleVersionSummary[]>([])
        : schedulesApi.versions(scheduleId, signal),
    [scheduleId],
  );
  const historyCollection = useCollection<ScheduleVersionSummary>(loadHistory);
  /** Only the newest version of a schedule can be edited, so this is measured, not assumed. */
  const isLatestVersion = React.useMemo(() => {
    if (historyCollection.items.length === 0 || version === null) {
      return null;
    }
    const newest = historyCollection.items.reduce((latest, candidate) =>
      candidate.version_number > latest.version_number ? candidate : latest,
    );
    return newest.id === version.id;
  }, [historyCollection.items, version]);

  const [selectedEntryId, setSelectedEntryId] = React.useState<number | null>(null);
  const [selectedSlotIds, setSelectedSlotIds] = React.useState<number[]>([]);
  const [roomChoice, setRoomChoice] = React.useState<'keep' | 'none' | number>('keep');
  const [pending, setPending] = React.useState<PendingChange[]>([]);
  const [notes, setNotes] = React.useState('');

  const [validation, setValidation] = React.useState<ManualEditValidationResult | null>(null);
  const [validatedFingerprint, setValidatedFingerprint] = React.useState<string | null>(null);
  const [rejection, setRejection] = React.useState<ManualEditRejectedResult | null>(null);
  const [applied, setApplied] = React.useState<ManualEditApplyResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);
  const [isApplying, setIsApplying] = React.useState(false);

  const semesterId = version?.schedule.semester.id ?? null;
  const selectedSession =
    sessions.find((session) => session.entryId === selectedEntryId) ?? null;

  const slotGroups = React.useMemo(
    () =>
      groupSlotsByWeekday(
        slotCollection.items,
        formatDay,
        semesterId,
        (slot) => {
          const semester = slot.working_day?.semester;
          if (semester === null || semester === undefined) {
            return null;
          }
          return typeof semester === 'number' ? semester : semester.id;
        },
      ),
    [slotCollection.items, semesterId],
  );

  const allSlotOptions = React.useMemo(
    () => slotGroups.flatMap((group) => group.slots),
    [slotGroups],
  );

  const selectedSlots = React.useMemo(
    () => allSlotOptions.filter((slot) => selectedSlotIds.includes(slot.id)),
    [allSlotOptions, selectedSlotIds],
  );

  const slotCheck = checkSlotSelection(selectedSlots);
  const currentFingerprint = proposalFingerprint(pending);
  const validationStale =
    validation !== null && validatedFingerprint !== currentFingerprint;
  const canApply =
    validation !== null &&
    validation.valid &&
    !validationStale &&
    pending.length > 0 &&
    !isApplying &&
    notes.length <= NOTES_MAX_LENGTH;

  /**
   * Any edit to the proposal invalidates a previous validation, so the Apply action
   * stays disabled until the server has seen the current batch.
   */
  const invalidateValidation = React.useCallback(() => {
    setValidation(null);
    setValidatedFingerprint(null);
  }, []);

  if (isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="Manual editing is scoped to a department, and no department is attached to this account."
      />
    );
  }

  if (!canReadScheduleHistory(capability)) {
    return (
      <RestrictedState
        title="Manual editing is not available for your role"
        description="Editing a stored draft belongs to the college administrator, department administrator and scheduler roles."
      />
    );
  }

  const addChange = () => {
    if (selectedSession === null) {
      setError('Select a session first.');
      return;
    }
    const change: PendingChange = {
      entryId: selectedSession.entryId ?? 0,
      sessionId: selectedSession.sessionId,
      timeSlotIds: selectedSlotIds,
      roomId:
        roomChoice === 'keep' ? undefined : roomChoice === 'none' ? null : Number(roomChoice),
      baseDayLabel: selectedSession.dayDisplay,
      baseTimeRange: formatTimeRange(selectedSession.startTime, selectedSession.endTime),
      baseRoomLabel: formatRoom(selectedSession.room),
      selectedDayOfWeek: selectedSlots[0]?.dayOfWeek ?? null,
    };

    if (!isChangeMeaningful(change, selectedSession)) {
      setError('This change requests nothing. Choose different periods, or another room.');
      return;
    }
    setError(null);
    setPending((current) => upsertPendingChange(current, change));
    invalidateValidation();
    setSelectedSlotIds([]);
    setRoomChoice('keep');
  };

  const validate = async () => {
    if (pending.length === 0) {
      return;
    }
    setIsValidating(true);
    setError(null);
    setRejection(null);
    setValidation(null);
    try {
      const result = await manualEditApi.validate(
        versionId,
        buildManualEditRequest(pending, notes),
      );
      setValidation(result);
      setValidatedFingerprint(currentFingerprint);
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        const body = asManualRejection(cause.payload);
        if (body) {
          setRejection(body);
          setValidation(body.validation ?? null);
          setValidatedFingerprint(currentFingerprint);
          return;
        }
      }
      setError(getApiErrorMessage(cause));
    } finally {
      setIsValidating(false);
    }
  };

  const apply = async () => {
    if (!canApply) {
      return;
    }
    setIsApplying(true);
    setError(null);
    setRejection(null);
    try {
      const result = await manualEditApi.apply(
        versionId,
        buildManualEditRequest(pending, notes),
      );
      setApplied(result);
      setPending([]);
      invalidateValidation();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        const body = asManualRejection(cause.payload);
        if (body) {
          setRejection(body);
          setPending([]);
          invalidateValidation();
          return;
        }
      }
      setError(getApiErrorMessage(cause));
    } finally {
      setIsApplying(false);
    }
  };

  const editContext = {
    scheduleScope: version?.schedule.scope ?? null,
    scheduleDepartmentId: version?.schedule.department?.id ?? null,
    status: version?.status ?? null,
    isLatestVersion,
  };
  const mayEdit = version !== null && canManualEditVersion(capability, editContext);

  return (
    <div className="space-y-6">
      <PageHeading
        title={version ? `Edit version V${version.version_number}` : `Edit version #${versionId}`}
        description="Move the placement of sessions in a draft. Applying stores a new immutable version; the edited version is never changed."
      />

      <Alert tone="info" title="Placement only">
        {MANUAL_EDIT_CONTENT_NOTICE}
      </Alert>
      <Alert tone="info" title="Pending changes are validated together">
        {MANUAL_EDIT_BATCH_NOTICE}
      </Alert>

      {versionResource.error ? (
        <Alert tone="danger" title="Version could not be loaded">
          {versionResource.error.detail}
        </Alert>
      ) : null}

      {version && !mayEdit ? (
        <Alert tone="warning" title="This version cannot be edited">
          <p>
            Only the newest DRAFT version of a schedule you manage can be edited. This
            version is {version.status}.
          </p>
          <Link className="mt-1 inline-block underline" href={SCHEDULING_ROUTES.schedules}>
            Open schedule history
          </Link>
        </Alert>
      ) : null}

      {error ? (
        <Alert tone="danger" title="The proposal could not be used">
          {error}
        </Alert>
      ) : null}

      {rejection ? (
        <Alert tone="danger" title={MANUAL_EDIT_REJECTION_LABELS[rejection.reason]}>
          <p>{rejection.message || MANUAL_EDIT_REJECTION_HELP[rejection.reason]}</p>
          <p className="mt-1 text-xs">
            <code>{rejection.reason}</code>
          </p>
          {rejection.validation ? (
            <div className="mt-3">
              <IssueList
                issues={toIssueRows(rejection.validation)}
                label="Manual edit issues"
              />
            </div>
          ) : null}
        </Alert>
      ) : null}

      {applied ? (
        <Alert tone="success" title={NEW_VERSION_MESSAGE}>
          <p>
            Version V{applied.version.version_number} ({applied.version.source},{' '}
            {applied.version.status}) stores {applied.summary.entries} session
            {applied.summary.entries === 1 ? '' : 's'}; {applied.summary.changed_entries}{' '}
            of them were moved.
          </p>
          <Link
            className="mt-1 inline-block underline"
            href={SCHEDULING_ROUTES.versionDetail(applied.version.id)}
          >
            Open the new version
          </Link>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Stored timetable</CardTitle>
          <CardDescription>
            Select a session to move. Every value shown is the version’s own snapshot.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">This version stores no session.</p>
          ) : (
            <>
              <TimetableView
                sessions={sessions}
                showDepartment={version?.schedule.scope === 'COLLEGE'}
              />
              <div className="text-sm">
                <label
                  htmlFor="manual-edit-entry"
                  className="text-xs uppercase tracking-wide text-muted-foreground"
                >
                  Session to move
                </label>
                <select
                  id="manual-edit-entry"
                  className="mt-1 h-10 w-full max-w-2xl rounded-md border border-line bg-surface px-2 text-sm"
                  value={selectedEntryId === null ? '' : String(selectedEntryId)}
                  onChange={(event) => {
                    setSelectedEntryId(event.target.value === '' ? null : Number(event.target.value));
                    setSelectedSlotIds([]);
                    setRoomChoice('keep');
                  }}
                >
                  <option value="">Select a session</option>
                  {sessions.map((session) => (
                    <option key={session.sessionId} value={session.entryId ?? 0}>
                      {session.course.code} · {session.teachingComponent.component_type} ·{' '}
                      {session.dayDisplay} {formatTimeRange(session.startTime, session.endTime)}{' '}
                      · {formatRoom(session.room)}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Placement</CardTitle>
          <CardDescription>
            Periods come from this semester’s configured teaching grid. The backend
            revalidates weekday, adjacency, duration, activity, availability and every
            collision.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          {slotGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active teaching period is configured for this semester.
            </p>
          ) : (
            slotGroups.map((group) => (
              <fieldset key={group.dayOfWeek} className="rounded-md border border-line px-3 py-2">
                <legend className="px-1 text-sm font-medium">{group.dayLabel}</legend>
                <div className="flex flex-wrap gap-2">
                  {group.slots.map((slot) => {
                    const checked = selectedSlotIds.includes(slot.id);
                    return (
                      <label
                        key={slot.id}
                        className="flex items-center gap-2 rounded-md border border-line px-2 py-1 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            invalidateValidation();
                            setSelectedSlotIds((current) =>
                              checked
                                ? current.filter((id) => id !== slot.id)
                                : [...current, slot.id],
                            );
                          }}
                        />
                        <span>
                          #{slot.sequence} {slot.label || 'Period'} ·{' '}
                          {formatTimeRange(slot.startTime, slot.endTime)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))
          )}

          {selectedSlots.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {selectedSlots.length} period{selectedSlots.length === 1 ? '' : 's'} ·{' '}
              {selectionMinutes(selectedSlots)} min
              {slotCheck.message ? ` · ${slotCheck.message}` : ''}
            </p>
          ) : null}

          <div className="text-sm">
            <label
              htmlFor="manual-edit-room"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Room
            </label>
            <select
              id="manual-edit-room"
              className="mt-1 h-10 w-full max-w-2xl rounded-md border border-line bg-surface px-2 text-sm"
              value={roomChoice === 'keep' ? 'keep' : roomChoice === 'none' ? 'none' : String(roomChoice)}
              onChange={(event) => {
                invalidateValidation();
                const value = event.target.value;
                setRoomChoice(value === 'keep' || value === 'none' ? value : Number(value));
              }}
            >
              <option value="keep">Keep the current room</option>
              <option value="none">Move to no room</option>
              {roomCollection.items
                .filter((room) => room.is_active)
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.code} — {room.name} · {room.capacity} seats · {room.room_type.code} ·
                    owned by {room.owner_department.code}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Every visible room is listed. Suitability is decided by the backend, which
              rechecks sharing, capacity, room type, capabilities, availability and
              collisions.
            </p>
          </div>

          <Button onClick={addChange} disabled={selectedSession === null}>
            Add to pending changes
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending changes ({pending.length})</CardTitle>
          <CardDescription>
            The whole batch is sent as one proposal, which is what makes a swap possible.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pending change yet. Select a session, choose periods or a room, then add it.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <caption className="sr-only">Pending manual-edit changes</caption>
                <thead>
                  <tr className="border-b border-line text-left">
                    <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                      Session
                    </th>
                    <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                      Current placement
                    </th>
                    <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                      Proposed
                    </th>
                    <th scope="col" className="px-2 py-1 text-right font-medium text-muted-foreground">
                      Remove
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((change) => (
                    <tr key={change.entryId} className="border-b border-line last:border-0">
                      <td className="px-2 py-1">
                        <code className="text-xs">{change.sessionId}</code>
                        <p className="text-xs text-muted-foreground">Entry #{change.entryId}</p>
                      </td>
                      <td className="px-2 py-1 text-xs text-muted-foreground">
                        {change.baseDayLabel} {change.baseTimeRange} · {change.baseRoomLabel}
                      </td>
                      <td className="px-2 py-1 text-xs">{describePendingChange(change)}</td>
                      <td className="px-2 py-1 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            invalidateValidation();
                            setPending((current) => removePendingChange(current, change.entryId));
                          }}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-sm">
            <label
              htmlFor="manual-edit-notes"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Notes (optional, up to {NOTES_MAX_LENGTH} characters)
            </label>
            <textarea
              id="manual-edit-notes"
              className="mt-1 min-h-20 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
              value={notes}
              maxLength={NOTES_MAX_LENGTH}
              disabled={isApplying}
              onChange={(event) => {
                invalidateValidation();
                setNotes(event.target.value);
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => void validate()}
              isLoading={isValidating}
              disabled={pending.length === 0 || isValidating || isApplying}
            >
              Validate proposal
            </Button>
            <Button
              onClick={() => void apply()}
              isLoading={isApplying}
              disabled={!canApply}
            >
              Apply validated proposal
            </Button>
            {validationStale ? (
              <span className="text-xs text-warning">
                The proposal changed since it was validated. Validate again to apply.
              </span>
            ) : null}
          </div>

          {validation ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={validation.valid ? 'success' : 'danger'}>
                  {validation.valid ? 'Valid proposal' : 'Invalid proposal'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {validation.summary.changes} change
                  {validation.summary.changes === 1 ? '' : 's'} ·{' '}
                  {validation.summary.errors} error
                  {validation.summary.errors === 1 ? '' : 's'}
                </span>
              </div>
              <IssueList
                issues={toIssueRows(validation)}
                label="Manual edit issues"
                emptyMessage="No issue was reported for this proposal."
              />
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">{PERSIST_DRAFT_MESSAGE}</p>
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * One normalized session as the picker needs it.
 *
 * Kept as a type alias so the picker and the pending table agree on the shape.
 */
export type EditableSession = TimetableSession;
