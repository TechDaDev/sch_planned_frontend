import { describe, expect, it } from 'vitest';

import {
  buildManualEditRequest,
  checkSlotSelection,
  describePendingChange,
  groupSlotsByWeekday,
  isChangeMeaningful,
  pendingChangeFromSession,
  proposalFingerprint,
  removePendingChange,
  selectionMinutes,
  upsertPendingChange,
  type PendingChange,
  type SlotOption,
  type SlotView,
} from '@/lib/scheduling/manual-edit';
import { sessionsFromEntries } from '@/lib/scheduling/normalization';
import { scheduleEntry } from '@/test/scheduling-fixtures';

const SESSIONS = sessionsFromEntries([
  scheduleEntry(),
  scheduleEntry({ id: 901, session_id: 'tc-11#s1', day_of_week: 2, day_display: 'Tuesday' }),
]);
const SESSION = SESSIONS[0]!;

function change(overrides: Partial<PendingChange> = {}): PendingChange {
  const base = pendingChangeFromSession(SESSION)!;
  return { ...base, ...overrides };
}

describe('pending manual-edit proposals', () => {
  it('captures the stored placement as the baseline of a change', () => {
    const pending = pendingChangeFromSession(SESSION)!;

    expect(pending.entryId).toBe(900);
    expect(pending.sessionId).toBe('tc-10#s1');
    expect(pending.baseDayLabel).toBe('Monday');
    expect(pending.baseTimeRange).toBe('09:00–11:00');
    expect(pending.baseRoomLabel).toContain('AI-LAB-1');
    expect(pending.roomId).toBeUndefined();
    expect(pending.timeSlotIds).toEqual([]);
  });

  it('refuses a session that has no persisted entry id', () => {
    expect(pendingChangeFromSession({ ...SESSION, entryId: undefined })).toBeNull();
  });

  it('replaces the previous change of the same entry and keeps the list ordered', () => {
    const first = change({ entryId: 900 });
    const second = change({ entryId: 901 });
    const replacement = change({ entryId: 900, roomId: null });

    const applied = upsertPendingChange(upsertPendingChange([first, second], second), replacement);

    expect(applied).toHaveLength(2);
    expect(applied.map((entry) => entry.entryId)).toEqual([900, 901]);
    expect(applied[0]!.roomId).toBeNull();
  });

  it('removes exactly one pending change', () => {
    const kept = removePendingChange([change({ entryId: 900 }), change({ entryId: 901 })], 900);

    expect(kept.map((entry) => entry.entryId)).toEqual([901]);
  });
});

describe('meaningfulness of a pending change', () => {
  it('rejects a change that requests nothing', () => {
    expect(isChangeMeaningful(change(), SESSION)).toBe(false);
  });

  it('accepts a new period selection', () => {
    expect(isChangeMeaningful(change({ timeSlotIds: [33, 34] }), SESSION)).toBe(true);
  });

  it('treats the stored periods in another order as no change', () => {
    expect(isChangeMeaningful(change({ timeSlotIds: [32, 31] }), SESSION)).toBe(false);
  });

  it('accepts a room-only move, including to no room', () => {
    expect(isChangeMeaningful(change({ roomId: 24 }), SESSION)).toBe(true);
    // The stored room is 22, so null (no room) is a real move.
    expect(isChangeMeaningful(change({ roomId: null }), SESSION)).toBe(true);
  });

  it('treats selecting the stored room as no change', () => {
    expect(isChangeMeaningful(change({ roomId: 22 }), SESSION)).toBe(false);
  });

  it('treats an absent session as plausible rather than assuming equality', () => {
    expect(isChangeMeaningful(change({ timeSlotIds: [31, 32] }), null)).toBe(true);
  });
});

describe('manual-edit request body', () => {
  it('sends only entry_id, time_slot_ids and room_id', () => {
    const request = buildManualEditRequest(
      [change({ entryId: 900, timeSlotIds: [33, 34], roomId: 24 })],
      'Move to the lab.',
    );

    expect(request).toEqual({
      notes: 'Move to the lab.',
      changes: [{ entry_id: 900, time_slot_ids: [33, 34], room_id: 24 }],
    });
    // No field for course, component, instructor or group exists at all.
    expect(Object.keys(request.changes[0]!)).toEqual(['entry_id', 'time_slot_ids', 'room_id']);
  });

  it('omits an untouched room and keeps an explicit "no room"', () => {
    const request = buildManualEditRequest(
      [change({ entryId: 900, timeSlotIds: [33] }), change({ entryId: 901, roomId: null })],
      '',
    );

    expect(request.changes[0]).toEqual({ entry_id: 900, time_slot_ids: [33] });
    expect(request.changes[1]).toEqual({ entry_id: 901, room_id: null });
    expect('room_id' in request.changes[0]!).toBe(false);
  });

  it('orders the periods so the same selection always produces the same body', () => {
    const request = buildManualEditRequest([change({ timeSlotIds: [34, 33] })], '');

    expect(request.changes[0]!.time_slot_ids).toEqual([33, 34]);
  });

  it('sends a whole batch as one proposal, which is what makes a swap possible', () => {
    const request = buildManualEditRequest(
      [
        change({ entryId: 900, timeSlotIds: [33, 34] }),
        change({ entryId: 901, timeSlotIds: [31, 32] }),
      ],
      'Swap the two sessions.',
    );

    expect(request.changes).toHaveLength(2);
  });
});

describe('proposal fingerprints', () => {
  it('is stable for the same proposal written in another order', () => {
    const left = proposalFingerprint([
      change({ entryId: 900, timeSlotIds: [33, 34], roomId: 24 }),
      change({ entryId: 901, roomId: null }),
    ]);
    const right = proposalFingerprint([
      change({ entryId: 901, roomId: null }),
      change({ entryId: 900, timeSlotIds: [34, 33], roomId: 24 }),
    ]);

    expect(left).toBe(right);
  });

  it('changes when a period, a room or the set of entries changes', () => {
    const base = proposalFingerprint([change({ entryId: 900, timeSlotIds: [33, 34] })]);

    expect(proposalFingerprint([change({ entryId: 900, timeSlotIds: [33] })])).not.toBe(base);
    expect(proposalFingerprint([change({ entryId: 900, timeSlotIds: [33, 34], roomId: 24 })])).not.toBe(base);
    expect(
      proposalFingerprint([
        change({ entryId: 900, timeSlotIds: [33, 34] }),
        change({ entryId: 901, roomId: null }),
      ]),
    ).not.toBe(base);
  });

  it('distinguishes keeping the room from moving to no room', () => {
    expect(proposalFingerprint([change({ roomId: undefined })])).not.toBe(
      proposalFingerprint([change({ roomId: null })]),
    );
  });

  it('is empty for an empty proposal', () => {
    expect(proposalFingerprint([])).toBe('');
  });
});

describe('pending change descriptions', () => {
  it('states what is being requested', () => {
    expect(describePendingChange(change({ timeSlotIds: [33, 34] }))).toBe('2 period(s)');
    expect(describePendingChange(change({ roomId: null }))).toBe('no room');
    expect(describePendingChange(change({ roomId: 24 }))).toBe('room #24');
    expect(describePendingChange(change({ timeSlotIds: [33], roomId: 24 }))).toBe(
      '1 period(s) · room #24',
    );
  });

  it('says so when nothing has been requested yet', () => {
    expect(describePendingChange(change())).toBe('No placement change yet');
  });
});

function slot(overrides: Partial<SlotView> = {}): SlotView {
  return {
    id: 31,
    sequence: 1,
    label: 'Period 1',
    start_time: '08:00:00',
    end_time: '09:00:00',
    working_day: { day_of_week: 0, semester: { id: 8 } },
    is_active: true,
    ...overrides,
  };
}

describe('teaching period selection', () => {
  it('groups active periods of the version semester by weekday, in week order', () => {
    const groups = groupSlotsByWeekday(
      [
        slot({ id: 41, sequence: 1, working_day: { day_of_week: 2, semester: { id: 8 } } }),
        slot({ id: 31, sequence: 1, working_day: { day_of_week: 0, semester: { id: 8 } } }),
        slot({ id: 32, sequence: 2, label: 'Period 2', working_day: { day_of_week: 0, semester: { id: 8 } } }),
      ],
      (value) => `day-${value}`,
      8,
      (entry) => (typeof entry.working_day.semester === 'number' ? entry.working_day.semester : entry.working_day.semester?.id ?? null),
    );

    expect(groups.map((group) => group.dayLabel)).toEqual(['day-0', 'day-2']);
    expect(groups[0]!.slots.map((option) => option.id)).toEqual([31, 32]);
    expect(groups[0]!.slots.map((option) => option.label)).toEqual(['Period 1', 'Period 2']);
  });

  it('never offers an inactive period or one from another semester', () => {
    const groups = groupSlotsByWeekday(
      [
        slot({ id: 31, is_active: false }),
        slot({ id: 32, working_day: { day_of_week: 0, semester: { id: 9 } } }),
      ],
      (value) => `day-${value}`,
      8,
      (entry) => (typeof entry.working_day.semester === 'number' ? entry.working_day.semester : entry.working_day.semester?.id ?? null),
    );

    expect(groups).toEqual([]);
  });

  it('accepts a semester id sent as a plain number', () => {
    const groups = groupSlotsByWeekday(
      [slot({ working_day: { day_of_week: 1, semester: 8 } })],
      (value) => `day-${value}`,
      8,
      (entry) => (typeof entry.working_day.semester === 'number' ? entry.working_day.semester : entry.working_day.semester?.id ?? null),
    );

    expect(groups).toHaveLength(1);
  });

  it('normalizes period times to `HH:MM`', () => {
    const option = groupSlotsByWeekday(
      [slot({ start_time: '08:00:00', end_time: '09:30:00' })],
      (value) => `day-${value}`,
      null,
      () => null,
    )[0]!.slots[0]!;

    expect(option.startTime).toBe('08:00');
    expect(option.endTime).toBe('09:30');
  });
});

function option(overrides: Partial<SlotOption> = {}): SlotOption {
  return {
    id: 31,
    dayOfWeek: 0,
    sequence: 1,
    label: 'Period 1',
    startTime: '08:00',
    endTime: '09:00',
    ...overrides,
  };
}

describe('period selection guidance', () => {
  it('requires at least one period', () => {
    expect(checkSlotSelection([]).plausible).toBe(false);
    expect(checkSlotSelection([]).message).toBe('Select at least one period.');
  });

  it('refuses periods spread over two weekdays', () => {
    const check = checkSlotSelection([option({ id: 31 }), option({ id: 51, dayOfWeek: 2 })]);

    expect(check.plausible).toBe(false);
    expect(check.message).toContain('same weekday');
  });

  it('refuses non-consecutive periods', () => {
    const check = checkSlotSelection([option({ id: 31, sequence: 1 }), option({ id: 33, sequence: 3 })]);

    expect(check.plausible).toBe(false);
    expect(check.message).toContain('consecutive');
  });

  it('accepts a consecutive selection inside one day', () => {
    const check = checkSlotSelection([
      option({ id: 31, sequence: 1 }),
      option({ id: 32, sequence: 2, label: 'Period 2', startTime: '09:00', endTime: '10:00' }),
    ]);

    expect(check).toEqual({ plausible: true, message: null });
  });

  it('measures the duration of a selection from its own times', () => {
    expect(selectionMinutes([])).toBe(0);
    expect(
      selectionMinutes([
        option({ id: 31, sequence: 1, startTime: '08:00', endTime: '09:00' }),
        option({ id: 32, sequence: 2, startTime: '09:00', endTime: '10:30' }),
      ]),
    ).toBe(150);
  });
});
