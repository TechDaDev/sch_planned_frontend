// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ToastProvider } from '@/components/providers/toast-provider';
import { SessionProvider } from '@/components/providers/session-provider';
import { CalendarExceptionsScreen } from '@/components/resources/screens/calendar-exceptions-screen';
import { RoomCapabilityAssignmentsScreen } from '@/components/resources/screens/room-capability-assignments-screen';
import { RoomsScreen } from '@/components/resources/screens/rooms-screen';
import { TeachingAssignmentsScreen } from '@/components/resources/screens/teaching-assignments-screen';
import {
  currentUserPayload,
  installFetchMock,
  jsonResponse,
} from '@/test/fetch-mock';
import {
  BIOAI_DEPARTMENT_ID,
  CS_DEPARTMENT_ID,
  instructorRow,
  roomCapabilityAssignmentRow,
  roomCapabilityRow,
  roomRow,
  roomTypeRow,
  teachingAssignmentRow,
} from '@/test/resource-fixtures';

const PROXY = '/api/backend';
const SESSION_URL = '/api/auth/session';

const DEPARTMENT_ADMIN = currentUserPayload({
  role: 'DEPARTMENT_ADMIN',
  department: { id: BIOAI_DEPARTMENT_ID, name: 'Biomedical AI', code: 'BIOAI' },
});

const SCHEDULER = currentUserPayload({
  role: 'SCHEDULER',
  department: { id: BIOAI_DEPARTMENT_ID, name: 'Biomedical AI', code: 'BIOAI' },
});

/** Minimal academic reference rows the screens resolve ownership against. */
const DEPARTMENT_ROWS = [
  { id: BIOAI_DEPARTMENT_ID, name: 'Biomedical AI', code: 'BIOAI' },
];
const SEMESTER_ROWS = [
  {
    id: 8,
    number: 1,
    start_date: '2026-09-01',
    end_date: '2027-01-15',
    academic_year: { id: 3, start_year: 2026, end_year: 2027 },
    is_active: true,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
  },
];

function renderScreen(element: React.ReactElement) {
  return render(
    <SessionProvider>
      <ToastProvider>{element}</ToastProvider>
    </SessionProvider>,
  );
}

describe('rooms screen — shared and foreign rows', () => {
  it('shows an owned room as editable and a shared foreign room as read only', async () => {
    const account = DEPARTMENT_ADMIN;
    installFetchMock([
      { url: SESSION_URL, handler: () => jsonResponse({ user: account }) },
      {
        url: `${PROXY}/rooms`,
        handler: () =>
          jsonResponse([
            roomRow({ id: 22, code: 'AI-LAB-1' }),
            roomRow({
              id: 55,
              code: 'CS-LAB-2',
              name: 'Computer Lab',
              owner_department: { id: CS_DEPARTMENT_ID, name: 'Computer Science', code: 'CS' },
              sharing_scope: 'SELECTED_DEPARTMENTS',
            }),
          ]),
      },
      { url: `${PROXY}/departments`, handler: () => jsonResponse(DEPARTMENT_ROWS) },
      {
        url: `${PROXY}/room-types?is_active=true`,
        handler: () => jsonResponse([roomTypeRow()]),
      },
    ]);

    render(
      <SessionProvider>
        <ToastProvider>
          <RoomsScreen />
        </ToastProvider>
      </SessionProvider>,
    );

    expect(await screen.findByText('CS-LAB-2')).toBeVisible();

    // Owned row: editable.
    expect(
      screen.getByRole('button', { name: 'Edit room AI-LAB-1 — Artificial Intelligence Lab' }),
    ).toBeVisible();
    // Shared foreign row: labelled and not editable.
    expect(screen.getAllByText('Shared').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: 'Edit room CS-LAB-2 — Computer Lab' }),
    ).toBeNull();
  });

  it('gives a scheduler no mutation controls and explains why', async () => {
    const account = SCHEDULER;
    installFetchMock([
      { url: SESSION_URL, handler: () => jsonResponse({ user: account }) },
      { url: `${PROXY}/rooms`, handler: () => jsonResponse([roomRow()]) },
      { url: `${PROXY}/departments`, handler: () => jsonResponse(DEPARTMENT_ROWS) },
      {
        url: `${PROXY}/room-types?is_active=true`,
        handler: () => jsonResponse([roomTypeRow()]),
      },
    ]);

    render(
      <SessionProvider>
        <ToastProvider>
          <RoomsScreen />
        </ToastProvider>
      </SessionProvider>,
    );

    expect(await screen.findByText('AI-LAB-1')).toBeVisible();
    expect(screen.queryByRole('button', { name: /^New / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /Deactivate|Activate/ })).toBeNull();
    expect(screen.getByText(/Read-only access/)).toBeVisible();
  });
});

describe('room capability assignments — immutable relationship row', () => {
  it('offers edit but no activate/deactivate and no delete', async () => {
    const account = DEPARTMENT_ADMIN;
    installFetchMock([
      { url: SESSION_URL, handler: () => jsonResponse({ user: account }) },
      {
        url: `${PROXY}/room-capability-assignments`,
        handler: () => jsonResponse([roomCapabilityAssignmentRow()]),
      },
      { url: `${PROXY}/rooms`, handler: () => jsonResponse([roomRow()]) },
      {
        url: `${PROXY}/room-capabilities?is_active=true`,
        handler: () => jsonResponse([roomCapabilityRow()]),
      },
    ]);

    render(
      <SessionProvider>
        <ToastProvider>
          <RoomCapabilityAssignmentsScreen />
        </ToastProvider>
      </SessionProvider>,
    );

    expect(await screen.findByText('COMPUTERS — Computers')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Edit capability assignment AI-LAB-1 — COMPUTERS' }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /Deactivate|Activate/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete|remove/i })).toBeNull();
    expect(screen.getByText(/no active flag and cannot be deleted/i)).toBeVisible();
  });
});

describe('calendar exceptions — dynamic scope target and full-day toggle', () => {
  const ROUTES = (user: unknown) => [
    { url: SESSION_URL, handler: () => jsonResponse({ user }) },
    {
      url: `${PROXY}/calendar-exceptions`,
      handler: () => jsonResponse([]),
    },
    { url: `${PROXY}/semesters`, handler: () => jsonResponse(SEMESTER_ROWS) },
    { url: `${PROXY}/departments`, handler: () => jsonResponse(DEPARTMENT_ROWS) },
    { url: `${PROXY}/instructors`, handler: () => jsonResponse([]) },
    { url: `${PROXY}/rooms`, handler: () => jsonResponse([]) },
    { url: `${PROXY}/student-groups`, handler: () => jsonResponse([]) },
    { url: `${PROXY}/stages`, handler: () => jsonResponse([]) },
    { url: `${PROXY}/programs`, handler: () => jsonResponse([]) },
  ];

  it('hides college scope from a department administrator', async () => {
    const account = DEPARTMENT_ADMIN;
    const user = userEvent.setup();
    installFetchMock(ROUTES(account));

    render(
      <SessionProvider>
        <ToastProvider>
          <CalendarExceptionsScreen />
        </ToastProvider>
      </SessionProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'New calendar exception' }));

    const dialog = await screen.findByRole('dialog', { name: 'Create calendar exception' });
    const scope = within(dialog).getByLabelText(/Scope/);
    const options = Array.from(scope.querySelectorAll('option'))
      .map((option) => option.value)
      .filter((value) => value.length > 0);

    expect(options).not.toContain('COLLEGE');
    expect(options).toEqual(['DEPARTMENT', 'INSTRUCTOR', 'ROOM', 'STUDENT_GROUP']);
  });

  it('pairs instructor absence with the instructor target and hides times for a full day', async () => {
    const account = DEPARTMENT_ADMIN;
    const user = userEvent.setup();
    installFetchMock(ROUTES(account));

    render(
      <SessionProvider>
        <ToastProvider>
          <CalendarExceptionsScreen />
        </ToastProvider>
      </SessionProvider>,
    );

    await user.click(await screen.findByRole('button', { name: 'New calendar exception' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create calendar exception' });

    // A full-day exception needs no times.
    expect(within(dialog).getByLabelText(/Full day/)).toBeChecked();
    expect(within(dialog).queryByLabelText(/Starts at/)).toBeNull();

    // Switching to instructor absence derives the instructor scope.
    await user.selectOptions(within(dialog).getByLabelText(/Exception type/), 'INSTRUCTOR_ABSENCE');
    await waitFor(() => {
      expect(within(dialog).getByLabelText(/Scope/)).toHaveValue('INSTRUCTOR');
    });
    expect(within(dialog).getByLabelText(/Instructor/)).toBeVisible();
    expect(within(dialog).queryByLabelText(/^Room$/)).toBeNull();

    // Clearing the full-day toggle reveals the partial-day window.
    await user.click(within(dialog).getByLabelText(/Full day/));
    expect(within(dialog).getByLabelText(/Starts at/)).toBeVisible();
    expect(within(dialog).getByLabelText(/Ends at/)).toBeVisible();
  });
});

describe('teaching assignments — single primary refusal', () => {
  it('keeps the form open and shows the backend primary-instructor error', async () => {
    const account = DEPARTMENT_ADMIN;
    const user = userEvent.setup();
    installFetchMock([
      { url: SESSION_URL, handler: () => jsonResponse({ user: account }) },
      {
        url: `${PROXY}/teaching-assignments`,
        method: 'GET',
        handler: () => jsonResponse([teachingAssignmentRow()]),
      },
      {
        url: `${PROXY}/teaching-assignments`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              assignment_role:
                'This teaching component already has an active primary instructor.',
            },
            400,
          ),
      },
      {
        url: `${PROXY}/teaching-components`,
        handler: () =>
          jsonResponse([
            {
              id: 10,
              component_type: 'THEORY',
              label: 'Lecture A',
              weekly_hours: '3.00',
              session_duration_hours: '1.50',
              sessions_per_week: 2,
              offering: {
                id: 9,
                offering_code: 'MAIN',
                course: { id: 7, name: 'Machine Learning', code: 'ML301' },
              },
              is_active: true,
              created_at: '2026-09-01T08:00:00Z',
              updated_at: '2026-09-01T08:00:00Z',
            },
          ]),
      },
      {
        url: `${PROXY}/course-offerings`,
        handler: () =>
          jsonResponse([
            {
              id: 9,
              offering_code: 'MAIN',
              course: { id: 7, name: 'Machine Learning', code: 'ML301' },
              semester: {
                id: 8,
                number: 1,
                academic_year: { id: 3, start_year: 2026, end_year: 2027 },
              },
              managing_department: {
                id: BIOAI_DEPARTMENT_ID,
                name: 'Biomedical AI',
                code: 'BIOAI',
              },
              total_weekly_hours: '3.00',
              is_active: true,
              created_at: '2026-09-01T08:00:00Z',
              updated_at: '2026-09-01T08:00:00Z',
            },
          ]),
      },
      { url: `${PROXY}/instructors`, handler: () => jsonResponse([instructorRow()]) },
      {
        url: `${PROXY}/instructor-department-access?is_active=true`,
        handler: () => jsonResponse([]),
      },
    ]);

    renderScreen(<TeachingAssignmentsScreen />);

    await user.click(await screen.findByRole('button', { name: 'New teaching assignment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create teaching assignment' });

    await user.selectOptions(within(dialog).getByLabelText(/Teaching component/), '10');
    await user.selectOptions(within(dialog).getByLabelText(/Instructor/), '1');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(
        within(dialog).getAllByText(
          'This teaching component already has an active primary instructor.',
        ).length,
      ).toBeGreaterThan(0);
    });
    expect(screen.getByRole('dialog', { name: 'Create teaching assignment' })).toBeVisible();
  });
});
