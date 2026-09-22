/**
 * Pending manual-edit proposal.
 *
 * The backend validates the whole `changes` list as one final timetable state, so a
 * swap is two changes in **one** request. This module keeps that shape: the user
 * builds a batch, sees every pending change, validates the batch, and applies it as
 * a single proposal. Nothing is applied per move.
 *
 * Only placement moves. Course, offering, component, instructors, student groups,
 * session ordinal and every snapshot value are excluded from the request by
 * construction: there is no field for them here.
 *
 * Client validation is guidance, never authority: changing the proposal after a
 * successful validation marks the previous result stale, and the backend revalidates
 * during apply regardless.
 */

import { formatRoom, formatTimeRange } from '@/lib/scheduling/formatters';
import { toClockTime } from '@/lib/scheduling/normalization';
import type {
  ManualEditChange,
  ManualEditRequest,
  TimetableSession,
} from '@/lib/scheduling/types';

/** One pending relocation of one stored entry, with the placement it started from. */
export interface PendingChange {
  /** Entry id, from the persisted version. */
  entryId: number;
  sessionId: string;
  /** Periods to occupy. Empty means "keep the entry's current periods". */
  timeSlotIds: number[];
  /** Target room, or `null` to move to no room. `undefined` keeps the current room. */
  roomId: number | null | undefined;
  /** Read-only context shown in the pending list, from the base version. */
  baseDayLabel: string;
  baseTimeRange: string;
  baseRoomLabel: string;
  /** Weekday the selected periods belong to, when periods were chosen. */
  selectedDayOfWeek: number | null;
}

/** The stored placement of an entry, as the pending list describes it. */
export function pendingChangeFromSession(
  session: TimetableSession,
  options: { timeSlotIds?: number[]; roomId?: number | null; dayOfWeek?: number | null } = {},
): PendingChange | null {
  if (session.entryId === undefined) {
    return null;
  }
  return {
    entryId: session.entryId,
    sessionId: session.sessionId,
    timeSlotIds: options.timeSlotIds ?? [],
    roomId: options.roomId,
    baseDayLabel: session.dayDisplay,
    baseTimeRange: formatTimeRange(session.startTime, session.endTime),
    baseRoomLabel: formatRoom(session.room),
    selectedDayOfWeek: options.dayOfWeek ?? null,
  };
}

/** Replace the pending change of an entry, or add it when it is new. */
export function upsertPendingChange(
  changes: readonly PendingChange[],
  change: PendingChange,
): PendingChange[] {
  const next = changes.filter((existing) => existing.entryId !== change.entryId);
  next.push(change);
  return next.sort((left, right) => left.entryId - right.entryId);
}

export function removePendingChange(
  changes: readonly PendingChange[],
  entryId: number,
): PendingChange[] {
  return changes.filter((change) => change.entryId !== entryId);
}

/**
 * Whether a pending change actually requests a placement move.
 *
 * The backend rejects a change that asks for nothing, so the UI does not let one
 * reach the proposal. A period list equal to the stored one counts as no change.
 */
export function isChangeMeaningful(
  change: PendingChange,
  session: TimetableSession | null,
): boolean {
  const roomChanged =
    change.roomId !== undefined && change.roomId !== (session?.room?.id ?? null);
  if (change.timeSlotIds.length === 0) {
    return roomChanged;
  }
  if (session === null) {
    return true;
  }
  const currentIds = session.slots
    .map((slot) => slot.id)
    .filter((id): id is number => typeof id === 'number');
  if (currentIds.length === 0) {
    return true;
  }
  const proposed = [...change.timeSlotIds].sort((left, right) => left - right);
  const current = [...currentIds].sort((left, right) => left - right);
  const timeChanged =
    proposed.length !== current.length ||
    proposed.some((id, index) => id !== current[index]);
  return timeChanged || roomChanged;
}

/** The exact request body of both manual-edit endpoints. */
export function buildManualEditRequest(
  changes: readonly PendingChange[],
  notes: string,
): ManualEditRequest {
  const payloadChanges: ManualEditChange[] = changes.map((change) => {
    const entry: ManualEditChange = { entry_id: change.entryId };
    if (change.timeSlotIds.length > 0) {
      entry.time_slot_ids = [...change.timeSlotIds].sort((left, right) => left - right);
    }
    if (change.roomId !== undefined) {
      entry.room_id = change.roomId;
    }
    return entry;
  });

  return { notes, changes: payloadChanges };
}

/**
 * Stable fingerprint of a proposal.
 *
 * Comparing it against the fingerprint that was validated tells the page whether a
 * previous validation still describes the current proposal.
 */
export function proposalFingerprint(changes: readonly PendingChange[]): string {
  return changes
    .map((change) => {
      const slots = [...change.timeSlotIds].sort((left, right) => left - right).join(',');
      const room = change.roomId === undefined ? 'keep' : String(change.roomId);
      return `${change.entryId}:${slots}:${room}`;
    })
    .sort()
    .join('|');
}

/** One-line human summary of a pending change, for the pending table. */
export function describePendingChange(change: PendingChange): string {
  const parts: string[] = [];
  if (change.timeSlotIds.length > 0) {
    parts.push(`${change.timeSlotIds.length} period(s)`);
  }
  if (change.roomId !== undefined) {
    parts.push(change.roomId === null ? 'no room' : `room #${change.roomId}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No placement change yet';
}

// --- Period selection -----------------------------------------------------

export interface SlotOption {
  id: number;
  dayOfWeek: number;
  sequence: number;
  label: string;
  startTime: string;
  endTime: string;
}

export interface SlotDayGroup {
  dayOfWeek: number;
  dayLabel: string;
  slots: SlotOption[];
}

export interface SlotView {
  id: number;
  sequence: number;
  label: string;
  start_time: string;
  end_time: string;
  /** The nesting differs between F2 endpoints, so both shapes are accepted. */
  working_day: { day_of_week: number; semester?: { id: number } | number | null };
  is_active: boolean;
}

/**
 * Group the semester's teaching periods by weekday.
 *
 * Only the configuration that belongs to the version's semester is offered, and the
 * periods are ordered the way the college week reads.
 */
export function groupSlotsByWeekday(
  slots: readonly SlotView[],
  dayLabel: (value: number) => string,
  semesterId: number | null,
  slotsSemesterId: (slot: SlotView) => number | null,
): SlotDayGroup[] {
  const groups = new Map<number, SlotOption[]>();

  for (const slot of slots) {
    if (!slot.is_active) {
      continue;
    }
    if (semesterId !== null && slotsSemesterId(slot) !== semesterId) {
      continue;
    }
    const dayOfWeek = slot.working_day.day_of_week;
    const option: SlotOption = {
      id: slot.id,
      dayOfWeek,
      sequence: slot.sequence,
      label: slot.label ?? '',
      startTime: toClockTime(slot.start_time),
      endTime: toClockTime(slot.end_time),
    };
    const bucket = groups.get(dayOfWeek);
    if (bucket) {
      bucket.push(option);
    } else {
      groups.set(dayOfWeek, [option]);
    }
  }

  return [...groups.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([dayOfWeek, options]) => ({
      dayOfWeek,
      dayLabel: dayLabel(dayOfWeek),
      slots: options.sort((left, right) => left.sequence - right.sequence),
    }));
}

export interface SlotSelectionCheck {
  /** True when no obvious mistake is visible in the selection. */
  plausible: boolean;
  /** Plain-language guidance; never a substitute for the backend's answer. */
  message: string | null;
}

/**
 * Guide an obviously invalid period selection.
 *
 * The backend remains authoritative for semester, weekday, adjacency, duration and
 * activity. This only spares the user an avoidable round trip.
 */
export function checkSlotSelection(selected: readonly SlotOption[]): SlotSelectionCheck {
  if (selected.length === 0) {
    return { plausible: false, message: 'Select at least one period.' };
  }
  const days = new Set(selected.map((slot) => slot.dayOfWeek));
  if (days.size > 1) {
    return {
      plausible: false,
      message: 'All periods of one session must fall on the same weekday.',
    };
  }
  const sequences = selected.map((slot) => slot.sequence).sort((left, right) => left - right);
  const contiguous = sequences.every(
    (sequence, index) => index === 0 || sequence === (sequences[index - 1] ?? 0) + 1,
  );
  if (!contiguous) {
    return {
      plausible: false,
      message: 'The selected periods must be consecutive inside one day.',
    };
  }
  return { plausible: true, message: null };
}

/** Total duration of a period selection, from its own start and end times. */
export function selectionMinutes(selected: readonly SlotOption[]): number {
  if (selected.length === 0) {
    return 0;
  }
  const ordered = [...selected].sort((left, right) => left.sequence - right.sequence);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) {
    return 0;
  }
  const start = toMinutesOfDay(first.startTime);
  const end = toMinutesOfDay(last.endTime);
  return start === null || end === null || end < start ? 0 : end - start;
}

function toMinutesOfDay(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(toClockTime(value));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
