// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '@/components/providers/session-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { ManualEditScreen } from '@/components/scheduling/manual-edit-screen';
import { currentUserPayload, installFetchMock, jsonResponse } from '@/test/fetch-mock';
import { BIOAI_DEPARTMENT, scheduleEntry, scheduleVersionDetail, scheduleVersionSummary } from '@/test/scheduling-fixtures';
import { manualEditApplyResult, manualEditValidation } from '@/test/f4-fixtures';

const PROXY = '/api/backend';
const SESSION_URL = '/api/auth/session';
const VERSION_URL = `${PROXY}/schedule-versions/501`;
const ENTRIES_URL = `${PROXY}/schedule-versions/501/entries`;
const HISTORY_URL = `${PROXY}/schedules/300/versions`;
const VALIDATE_URL = `${PROXY}/schedule-versions/501/validate-manual-edit`;
const APPLY_URL = `${PROXY}/schedule-versions/501/manual-edit`;

const COLLEGE_ADMIN = currentUserPayload({ role: 'COLLEGE_ADMIN', department: null });
const DEPARTMENT_ADMIN = currentUserPayload({
  role: 'DEPARTMENT_ADMIN',
  department: { id: BIOAI_DEPARTMENT.id, name: BIOAI_DEPARTMENT.name, code: BIOAI_DEPARTMENT.code },
});
const SCHEDULER = currentUserPayload({
  role: 'SCHEDULER',
  department: { id: BIOAI_DEPARTMENT.id, name: BIOAI_DEPARTMENT.name, code: BIOAI_DEPARTMENT.code },
});
const VIEWER = currentUserPayload({
  role: 'VIEWER',
  department: { id: BIOAI_DEPARTMENT.id, name: BIOAI_DEPARTMENT.name, code: BIOAI_DEPARTMENT.code },
});
const INSTRUCTOR = currentUserPayload({
  role: 'INSTRUCTOR',
  department: { id: BIOAI_DEPARTMENT.id, name: BIOAI_DEPARTMENT.name, code: BIOAI_DEPARTMENT.code },
});

/** Active periods of semester 8: two on Sunday, two on Monday. */
const TIME_SLOTS = [
  {
    id: 31,
    sequence: 1,
    label: 'Period 1',
    start_time: '08:00:00',
    end_time: '09:00:00',
    working_day: { id: 1, semester: { id: 8 }, day_of_week: 0 },
    is_active: true,
  },
  {
    id: 32,
    sequence: 2,
    label: 'Period 2',
    start_time: '09:00:00',
    end_time: '10:00:00',
    working_day: { id: 1, semester: { id: 8 }, day_of_week: 0 },
    is_active: true,
  },
  {
    id: 33,
    sequence: 1,
    label: 'Period 1',
    start_time: '08:00:00',
    end_time: '09:00:00',
    working_day: { id: 2, semester: { id: 8 }, day_of_week: 1 },
    is_active: true,
  },
  {
    id: 34,
    sequence: 2,
    label: 'Period 2',
    start_time: '09:00:00',
    end_time: '10:00:00',
    working_day: { id: 2, semester: { id: 8 }, day_of_week: 1 },
    is_active: true,
  },
  // Another semester: never offered for this version.
  {
    id: 99,
    sequence: 1,
    label: 'Period 1',
    start_time: '08:00:00',
    end_time: '09:00:00',
    working_day: { id: 3, semester: { id: 9 }, day_of_week: 1 },
    is_active: true,
  },
  // Inactive: never offered.
  {
    id: 98,
    sequence: 3,
    label: 'Period 3',
    start_time: '10:00:00',
    end_time: '11:00:00',
    working_day: { id: 2, semester: { id: 8 }, day_of_week: 1 },
    is_active: false,
  },
];

const ROOMS = [
  {
    id: 22,
    code: 'AI-LAB-1',
    name: 'Artificial Intelligence Lab',
    capacity: 40,
    room_type: { id: 1, name: 'Laboratory', code: 'LAB' },
    owner_department: BIOAI_DEPARTMENT,
    sharing_scope: 'COLLEGE_WIDE',
    is_active: true,
  },
  {
    id: 24,
    code: 'AI-201',
    name: 'Lecture Hall 201',
    capacity: 80,
    room_type: { id: 2, name: 'Lecture hall', code: 'HALL' },
    owner_department: BIOAI_DEPARTMENT,
    sharing_scope: 'PRIVATE',
    is_active: true,
  },
];

interface Options {
  account?: unknown;
  status?: 'DRAFT' | 'SUBMITTED' | 'PUBLISHED';
  isLatest?: boolean;
}

function baseRoutes(options: Options = {}) {
  const status = options.status ?? 'DRAFT';
  const history =
    options.isLatest === false
      ? [
          scheduleVersionSummary({ id: 502, version_number: 2, status: 'SUBMITTED' }),
          scheduleVersionSummary({ id: 501, version_number: 1, status }),
        ]
      : [scheduleVersionSummary({ id: 501, version_number: 1, status })];

  return [
    { url: SESSION_URL, handler: () => jsonResponse({ user: options.account ?? COLLEGE_ADMIN }) },
    {
      url: VERSION_URL,
      handler: () =>
        jsonResponse(
          scheduleVersionDetail({
            id: 501,
            version_number: 1,
            status,
            schedule: {
              id: 300,
              scope: 'DEPARTMENT',
              semester: { id: 8, number: 1, academic_year: { id: 3, start_year: 2026, end_year: 2027 } },
              department: BIOAI_DEPARTMENT,
            },
          }),
        ),
    },
    { url: ENTRIES_URL, handler: () => jsonResponse([scheduleEntry()]) },
    { url: HISTORY_URL, handler: () => jsonResponse(history) },
    { url: `${PROXY}/time-slots`, handler: () => jsonResponse(TIME_SLOTS) },
    { url: `${PROXY}/rooms`, handler: () => jsonResponse(ROOMS) },
  ];
}

function renderScreen(element: React.ReactElement) {
  return render(
    <SessionProvider>
      <ToastProvider>{element}</ToastProvider>
    </SessionProvider>,
  );
}

/**
 * Select the stored session, then choose one period of one weekday and add the change
 * to the batch. The stored entry occupies Sunday periods 31 and 32, so a Monday period
 * is always a real move.
 *
 * The editor unlocks only once the schedule history has confirmed the newest version,
 * so the test waits for that exactly as a scheduler would.
 */
async function addPendingChange(
  user: ReturnType<typeof userEvent.setup>,
  options: { day?: string; period?: RegExp; room?: string } = {},
) {
  await waitFor(() => {
    expect(screen.getByLabelText('Session to move')).toBeEnabled();
  });
  await user.selectOptions(screen.getByLabelText('Session to move'), '900');
  const group = screen.getByRole('group', { name: options.day ?? 'Monday' });
  await user.click(within(group).getByLabelText(options.period ?? /Period 1/));
  if (options.room) {
    await user.selectOptions(screen.getByLabelText('Room'), options.room);
  }
  await user.click(screen.getByRole('button', { name: 'Add to pending changes' }));
}

/** Wait until the editor is unlocked, for tests that drive the form directly. */
async function waitForEditableForm() {
  await waitFor(() => {
    expect(screen.getByLabelText('Session to move')).toBeEnabled();
  });
}

function bodyOf(call: { init: RequestInit }): Record<string, unknown> {
  return JSON.parse(String(call.init.body ?? '{}')) as Record<string, unknown>;
}

describe('manual edit screen', () => {
  it('offers only the periods of the version semester, grouped by weekday', async () => {
    installFetchMock(baseRoutes());

    renderScreen(<ManualEditScreen versionId={501} />);

    expect(await screen.findByRole('group', { name: 'Sunday' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Monday' })).toBeVisible();
    // Semester 9 and the inactive period are never offered.
    expect(screen.getAllByLabelText(/#1 Period 1/)).toHaveLength(2);
    expect(screen.queryByLabelText(/#3 Period 3/)).toBeNull();
  });

  it('builds a pending change from a session, periods and a room', async () => {
    const user = userEvent.setup();
    installFetchMock(baseRoutes({ account: DEPARTMENT_ADMIN }));

    renderScreen(<ManualEditScreen versionId={501} />);
    await addPendingChange(user, { room: '24' });

    expect(screen.getByText('Entry #900')).toBeVisible();
    expect(
      screen.getAllByText(/Monday 09:00–11:00 · AI-LAB-1 — Artificial Intelligence Lab/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('1 period(s) · room #24')).toBeVisible();
  });

  it('refuses a change that requests nothing', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes({ account: DEPARTMENT_ADMIN }),
      { url: VALIDATE_URL, method: 'POST', handler: () => jsonResponse(manualEditValidation()) },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);
    await waitForEditableForm();
    await user.selectOptions(screen.getByLabelText('Session to move'), '900');
    await user.click(screen.getByRole('button', { name: 'Add to pending changes' }));

    expect(await screen.findByText(/This change requests nothing/i)).toBeVisible();
    expect(screen.getByText('Pending changes (0)')).toBeVisible();
  });

  it('posts only placement fields when validating', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(),
      { url: VALIDATE_URL, method: 'POST', handler: () => jsonResponse(manualEditValidation()) },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);
    await addPendingChange(user, { room: '24' });
    await user.click(screen.getByRole('button', { name: 'Validate proposal' }));

    await waitFor(() => {
      expect(mock.callsTo(VALIDATE_URL)).toHaveLength(1);
    });
    const body = bodyOf(mock.callsTo(VALIDATE_URL)[0]!);
    expect(body).toEqual({ notes: '', changes: [{ entry_id: 900, time_slot_ids: [33], room_id: 24 }] });
    // No course, component, instructor, group or snapshot field exists.
    const change = (body.changes as Record<string, unknown>[])[0]!;
    expect(Object.keys(change).sort()).toEqual(['entry_id', 'room_id', 'time_slot_ids']);
  });

  it('reports a valid proposal and then applies it as a new version', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(),
      { url: VALIDATE_URL, method: 'POST', handler: () => jsonResponse(manualEditValidation()) },
      { url: APPLY_URL, method: 'POST', handler: () => jsonResponse(manualEditApplyResult()) },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);
    await addPendingChange(user, { room: '24' });
    await user.click(screen.getByRole('button', { name: 'Validate proposal' }));

    expect(await screen.findByText('Valid proposal')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Apply validated proposal' }));

    expect(await screen.findByText('New immutable draft version created.')).toBeVisible();
    expect(screen.getByText(/Version V2 \(MANUAL_EDIT, DRAFT\)/)).toBeVisible();
    expect(screen.getByText(/stores 12 sessions; 1 of them were moved/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open the new version' })).toBeVisible();
    expect(mock.callsTo(APPLY_URL)[0]!.method).toBe('POST');
  });

  it('applies a swap as two changes of one proposal', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes().filter((route) => route.url !== ENTRIES_URL),
      {
        url: ENTRIES_URL,
        handler: () =>
          jsonResponse([
            scheduleEntry(),
            scheduleEntry({ id: 901, session_id: 'tc-11#s1', day_of_week: 2, day_display: 'Tuesday' }),
          ]),
      },
      {
        url: VALIDATE_URL,
        method: 'POST',
        handler: () =>
          jsonResponse(manualEditValidation({ summary: { changes: 2, errors: 0 } })),
      },
      { url: APPLY_URL, method: 'POST', handler: () => jsonResponse(manualEditApplyResult({ summary: { entries: 12, changed_entries: 2 } })) },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);
    await addPendingChange(user, { room: '24' });
    await user.selectOptions(screen.getByLabelText('Session to move'), '901');
    await user.click(within(screen.getByRole('group', { name: 'Sunday' })).getByLabelText(/Period 1/));
    await user.click(screen.getByRole('button', { name: 'Add to pending changes' }));

    expect(screen.getByText('Pending changes (2)')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Validate proposal' }));
    await user.click(await screen.findByRole('button', { name: 'Apply validated proposal' }));

    await waitFor(() => {
      expect(mock.callsTo(APPLY_URL)).toHaveLength(1);
    });
    const body = bodyOf(mock.callsTo(APPLY_URL)[0]!);
    expect(body.changes).toHaveLength(2);
    expect(screen.getByText(/2 of them were moved/i)).toBeVisible();
  });

  it('removes a pending change and the whole batch after an apply', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(),
      { url: VALIDATE_URL, method: 'POST', handler: () => jsonResponse(manualEditValidation()) },
      { url: APPLY_URL, method: 'POST', handler: () => jsonResponse(manualEditApplyResult()) },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);
    await addPendingChange(user, { room: 'none' });
    expect(screen.getByText('Pending changes (1)')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Pending changes (0)')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Validate proposal' })).toBeDisabled();
  });

  it('invalidates a previous validation as soon as the proposal changes', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(),
      { url: VALIDATE_URL, method: 'POST', handler: () => jsonResponse(manualEditValidation()) },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);
    await addPendingChange(user, { room: '24' });
    await user.click(screen.getByRole('button', { name: 'Validate proposal' }));
    expect(await screen.findByText('Valid proposal')).toBeVisible();

    // Editing the notes is a change to the proposal.
    await user.type(screen.getByLabelText(/Notes/), 'x');

    expect(screen.queryByText('Valid proposal')).toBeNull();
    expect(
      await screen.findByRole('button', { name: 'Apply validated proposal' }),
    ).toBeDisabled();
  });

  it('keeps Apply disabled after the proposal changed, until it is validated again', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(),
      { url: VALIDATE_URL, method: 'POST', handler: () => jsonResponse(manualEditValidation()) },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);
    await addPendingChange(user, { room: '24' });
    await user.click(screen.getByRole('button', { name: 'Validate proposal' }));
    await screen.findByText('Valid proposal');

    await user.click(within(screen.getByRole('group', { name: 'Sunday' })).getByLabelText(/Period 1/));
    await user.click(screen.getByRole('button', { name: 'Add to pending changes' }));

    const apply = screen.getByRole('button', { name: 'Apply validated proposal' });
    expect(apply).toBeDisabled();
    expect(screen.queryByText('The proposal changed since it was validated. Validate again to apply.')).toBeNull();
  });

  it('renders an invalid proposal with its issues and blocks the apply', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(),
      {
        url: VALIDATE_URL,
        method: 'POST',
        handler: () =>
          jsonResponse(
            manualEditValidation({
              valid: false,
              summary: { changes: 1, errors: 1 },
              issues: [
                {
                  code: 'ROOM_DOUBLE_BOOKED',
                  message: 'Room AI-201 is already booked at that time.',
                  entry_id: 900,
                  conflicting_entry_id: 902,
                  details: { room: 'AI-201' },
                },
              ],
            }),
          ),
      },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);
    await addPendingChange(user, { room: '24' });
    await user.click(screen.getByRole('button', { name: 'Validate proposal' }));

    expect(await screen.findByText('Invalid proposal')).toBeVisible();
    expect(screen.getByText('ROOM_DOUBLE_BOOKED')).toBeVisible();
    expect(screen.getByText(/already booked/i)).toBeVisible();
    expect(screen.getAllByText('Entry #900').length).toBeGreaterThan(0);
    expect(screen.getByText('Conflicts with entry #902')).toBeVisible();
    expect(screen.getByText('room')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Apply validated proposal' })).toBeDisabled();
  });

  it('renders a manual-edit refusal and states that nothing was stored', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(),
      { url: VALIDATE_URL, method: 'POST', handler: () => jsonResponse(manualEditValidation()) },
      {
        url: APPLY_URL,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              persisted: false,
              reason: 'MANUAL_EDIT_VALIDATION_FAILED',
              message: '',
              base_version: 501,
              validation: manualEditValidation({
                valid: false,
                summary: { changes: 1, errors: 1 },
                issues: [
                  { code: 'INSTRUCTOR_UNAVAILABLE', message: 'The instructor is not available.', entry_id: 900 },
                ],
              }),
            },
            409,
          ),
      },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);
    await addPendingChange(user, { room: '24' });
    await user.click(screen.getByRole('button', { name: 'Validate proposal' }));
    await screen.findByText('Valid proposal');
    await user.click(screen.getByRole('button', { name: 'Apply validated proposal' }));

    expect(await screen.findByText('Proposed change is invalid')).toBeVisible();
    expect(screen.getByText('MANUAL_EDIT_VALIDATION_FAILED')).toBeVisible();
    expect(screen.getByText(/INSTRUCTOR_UNAVAILABLE/)).toBeVisible();
    // The refused batch is cleared, so nothing is resubmitted blindly.
    expect(screen.getByText('Pending changes (0)')).toBeVisible();
  });

  it('reports a stale base version as such instead of retrying', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(),
      { url: VALIDATE_URL, method: 'POST', handler: () => jsonResponse(manualEditValidation()) },
      {
        url: APPLY_URL,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              persisted: false,
              reason: 'STALE_BASE_VERSION',
              message: '',
              base_version: 501,
              validation: null,
            },
            409,
          ),
      },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);
    await addPendingChange(user, { room: 'none' });
    await user.click(screen.getByRole('button', { name: 'Validate proposal' }));
    await screen.findByText('Valid proposal');
    await user.click(screen.getByRole('button', { name: 'Apply validated proposal' }));

    expect(await screen.findByText('A newer version exists')).toBeVisible();
    expect(screen.getByText('STALE_BASE_VERSION')).toBeVisible();
    // No message was sent, so the documented help copy is shown instead.
    expect(
      screen.getByText(/A newer version now exists\. Refresh the schedule history before editing again\./),
    ).toBeVisible();
  });

  it('refuses to edit a version that is not a draft or not the newest', async () => {
    installFetchMock(baseRoutes({ status: 'SUBMITTED' }));

    renderScreen(<ManualEditScreen versionId={501} />);

    expect(await screen.findByText('This version cannot be edited')).toBeVisible();
    expect(screen.getByText(/This version is SUBMITTED\./)).toBeVisible();
    // A version that has already moved on is readable but not editable.
    expect(await screen.findByLabelText('Session to move')).toBeDisabled();
    expect(screen.getByLabelText('Room')).toBeDisabled();
  });

  it('refuses to edit a version that is not the newest one', async () => {
    installFetchMock(baseRoutes({ isLatest: false }));

    renderScreen(<ManualEditScreen versionId={501} />);

    expect(await screen.findByText('This version cannot be edited')).toBeVisible();
    expect(await screen.findByLabelText('Session to move')).toBeDisabled();
    expect(screen.getByLabelText('Room')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to pending changes' })).toBeDisabled();
  });

  it('offers a viewer no editable version, because editing is not its role', async () => {
    installFetchMock(baseRoutes({ account: VIEWER }));

    renderScreen(<ManualEditScreen versionId={501} />);

    expect(await screen.findByText('This version cannot be edited')).toBeVisible();
  });

  it('keeps a viewer read-only after a session is selected', async () => {
    const user = userEvent.setup();
    installFetchMock(baseRoutes({ account: VIEWER }));

    renderScreen(<ManualEditScreen versionId={501} />);

    await user.selectOptions(await screen.findByLabelText('Session to move'), '900');

    expect(screen.getByRole('button', { name: 'Add to pending changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Validate proposal' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Apply validated proposal' })).toBeDisabled();
  });

  it('makes every viewer control inert and sends no request at all', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes({ account: VIEWER }),
      { url: VALIDATE_URL, method: 'POST', handler: () => jsonResponse(manualEditValidation()) },
      { url: APPLY_URL, method: 'POST', handler: () => jsonResponse(manualEditApplyResult()) },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);

    // The page stays readable, and says why it is read-only.
    expect(await screen.findByText('This version cannot be edited')).toBeVisible();
    expect(screen.getAllByText(/read-only for your role/i).length).toBeGreaterThan(0);

    // Every editing control is inert, including the placement controls.
    expect(await screen.findByLabelText('Session to move')).toBeDisabled();
    expect(screen.getAllByLabelText(/#1 Period 1/)[0]).toBeDisabled();
    expect(screen.getByLabelText('Room')).toBeDisabled();
    expect(screen.getByLabelText(/Notes/)).toBeDisabled();

    // Attempting each interaction changes nothing and sends nothing.
    await user.click(screen.getAllByLabelText(/#1 Period 1/)[0]!);
    await user.click(screen.getByRole('button', { name: 'Add to pending changes' }));
    await user.click(screen.getByRole('button', { name: 'Validate proposal' }));
    await user.click(screen.getByRole('button', { name: 'Apply validated proposal' }));

    expect(screen.getByText('Pending changes (0)')).toBeVisible();
    expect(mock.countTo(VALIDATE_URL)).toBe(0);
    expect(mock.countTo(APPLY_URL)).toBe(0);
  });

  it('refuses the screen to an instructor', async () => {
    installFetchMock(baseRoutes({ account: INSTRUCTOR }));

    renderScreen(<ManualEditScreen versionId={501} />);

    expect(
      await screen.findByText(/Manual editing is not available for your role/i),
    ).toBeVisible();
  });

  it('gives a scheduler the same placement-only controls', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes({ account: SCHEDULER }),
      { url: VALIDATE_URL, method: 'POST', handler: () => jsonResponse(manualEditValidation()) },
    ]);

    renderScreen(<ManualEditScreen versionId={501} />);
    await addPendingChange(user, { room: '24' });

    expect(screen.getByText('Pending changes (1)')).toBeVisible();
    // No control exists for content that is not placement.
    expect(screen.queryByLabelText(/course/i)).toBeNull();
    expect(screen.queryByLabelText(/instructor/i)).toBeNull();
    expect(screen.queryByLabelText(/student group/i)).toBeNull();
    expect(screen.getByText(/moves placement only/i)).toBeVisible();
  });

  it('states that the whole batch is validated as one timetable state', async () => {
    installFetchMock(baseRoutes());

    renderScreen(<ManualEditScreen versionId={501} />);

    expect(
      await screen.findByText(/validated and applied as one final timetable state/i),
    ).toBeVisible();
  });
});
