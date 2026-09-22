// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '@/components/providers/session-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { AuditDetailScreen, AuditScreen } from '@/components/audit/audit-screens';
import { AUDIT_SNAPSHOT_NOTICE } from '@/lib/scheduling/constants';
import { currentUserPayload, installFetchMock, jsonResponse } from '@/test/fetch-mock';
import { BIOAI_DEPARTMENT, CS_DEPARTMENT } from '@/test/scheduling-fixtures';
import { auditEvent } from '@/test/f4-fixtures';

const PROXY = '/api/backend';
const SESSION_URL = '/api/auth/session';
const EVENTS_URL = `${PROXY}/audit-events`;

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

const DEPARTMENTS = [
  { ...BIOAI_DEPARTMENT, college: null, is_active: true, created_at: '', updated_at: '' },
  { ...CS_DEPARTMENT, college: null, is_active: true, created_at: '', updated_at: '' },
];

const SEMESTERS = [
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

function baseRoutes(account: unknown) {
  return [
    { url: SESSION_URL, handler: () => jsonResponse({ user: account }) },
    { url: `${PROXY}/semesters`, handler: () => jsonResponse(SEMESTERS) },
    { url: `${PROXY}/departments`, handler: () => jsonResponse(DEPARTMENTS) },
  ];
}

function renderScreen(element: React.ReactElement) {
  return render(
    <SessionProvider>
      <ToastProvider>{element}</ToastProvider>
    </SessionProvider>,
  );
}

describe('audit trail', () => {
  it('lists events with their action, actor snapshot, department and object', async () => {
    installFetchMock([...baseRoutes(COLLEGE_ADMIN), { url: EVENTS_URL, handler: () => jsonResponse([auditEvent()]) }]);

    renderScreen(<AuditScreen />);

    expect((await screen.findAllByText('Manual edit applied')).length).toBeGreaterThan(0);
    expect(screen.getByText('r.salim (SCHEDULER)')).toBeVisible();
    expect(screen.getAllByText('BIOAI — Biomedical AI').length).toBeGreaterThan(0);
    expect(screen.getByText('ScheduleVersion #502')).toBeVisible();
    expect(screen.getByText('2026-09-21 12:00')).toBeVisible();
  });

  it('states that actor identity is the event-time snapshot', async () => {
    installFetchMock([...baseRoutes(COLLEGE_ADMIN), { url: EVENTS_URL, handler: () => jsonResponse([]) }]);

    renderScreen(<AuditScreen />);

    expect(await screen.findByText('Actor identity is the event-time snapshot')).toBeVisible();
    expect(screen.getByText(AUDIT_SNAPSHOT_NOTICE)).toBeVisible();
  });

  it('keeps an event readable after the account was removed', async () => {
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: EVENTS_URL,
        handler: () =>
          jsonResponse([
            auditEvent({ actor: { id: null, username_snapshot: 'r.salim', role_snapshot: 'SCHEDULER' } }),
          ]),
      },
    ]);

    renderScreen(<AuditScreen />);

    expect(await screen.findByText('r.salim (SCHEDULER)')).toBeVisible();
    expect(screen.getByText('account removed')).toBeVisible();
  });

  it('sends an action filter to the backend', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: EVENTS_URL, handler: () => jsonResponse([auditEvent()]) },
      {
        url: `${EVENTS_URL}?action=SCHEDULE_PUBLISHED`,
        handler: () => jsonResponse([]),
      },
    ]);

    renderScreen(<AuditScreen />);
    await screen.findAllByText('Manual edit applied');

    await user.selectOptions(screen.getByLabelText('Action'), 'SCHEDULE_PUBLISHED');

    expect(mock.callsTo(`${EVENTS_URL}?action=SCHEDULE_PUBLISHED`)).toHaveLength(1);
  });

  it('sends a date range as full-day timestamps', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: EVENTS_URL, handler: () => jsonResponse([]) },
      {
        url: `${EVENTS_URL}?created_after=2026-09-01T00%3A00%3A00&created_before=2026-09-30T23%3A59%3A59`,
        handler: () => jsonResponse([]),
      },
    ]);

    renderScreen(<AuditScreen />);
    await screen.findByText('No audit event matches these filters. College-wide operations store no department, so a department administrator never sees them.');

    await user.type(screen.getByLabelText('Created after'), '2026-09-01');
    await user.type(screen.getByLabelText('Created before'), '2026-09-30');

    expect(
      mock.callsTo(
        `${EVENTS_URL}?created_after=2026-09-01T00%3A00%3A00&created_before=2026-09-30T23%3A59%3A59`,
      ),
    ).toHaveLength(1);
  });

  it('clears every filter on demand', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: EVENTS_URL, handler: () => jsonResponse([]) },
      { url: `${EVENTS_URL}?action=SCHEDULE_APPROVED`, handler: () => jsonResponse([]) },
    ]);

    renderScreen(<AuditScreen />);
    await screen.findByText(/No audit event matches these filters/);
    await user.selectOptions(screen.getByLabelText('Action'), 'SCHEDULE_APPROVED');
    expect(mock.countTo(`${EVENTS_URL}?action=SCHEDULE_APPROVED`)).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(mock.countTo(EVENTS_URL)).toBeGreaterThan(1);
  });

  it('offers the department filter only to a role that may choose one', async () => {
    installFetchMock([...baseRoutes(COLLEGE_ADMIN), { url: EVENTS_URL, handler: () => jsonResponse([]) }]);

    renderScreen(<AuditScreen />);
    await screen.findByText(/No audit event matches these filters/);

    expect(screen.getByLabelText('Department (optional)')).toBeVisible();
  });

  it('gives a department administrator no department filter of its own', async () => {
    installFetchMock([...baseRoutes(DEPARTMENT_ADMIN), { url: EVENTS_URL, handler: () => jsonResponse([]) }]);

    renderScreen(<AuditScreen />);
    await screen.findByText(/No audit event matches these filters/);

    expect(screen.queryByLabelText('Department (optional)')).toBeNull();
  });

  it('refuses the trail to a scheduler, a viewer and an instructor', async () => {
    for (const account of [SCHEDULER, VIEWER, INSTRUCTOR]) {
      installFetchMock(baseRoutes(account));

      const { unmount } = renderScreen(<AuditScreen />);
      expect(
        await screen.findByText(/The audit trail is not available for your role/i),
      ).toBeVisible();
      unmount();
    }
  });

  it('refuses an account with no department', async () => {
    installFetchMock(baseRoutes(currentUserPayload({ role: 'DEPARTMENT_ADMIN', department: null })));

    renderScreen(<AuditScreen />);

    expect(await screen.findByText(/No department is assigned to this account/i)).toBeVisible();
  });

  it('shows an empty state when no event matches', async () => {
    installFetchMock([...baseRoutes(COLLEGE_ADMIN), { url: EVENTS_URL, handler: () => jsonResponse([]) }]);

    renderScreen(<AuditScreen />);

    expect(await screen.findByText(/College-wide operations store no department/i)).toBeVisible();
  });

  it('offers no control that writes an audit event', async () => {
    installFetchMock([...baseRoutes(COLLEGE_ADMIN), { url: EVENTS_URL, handler: () => jsonResponse([auditEvent()]) }]);

    renderScreen(<AuditScreen />);
    await screen.findAllByText('Manual edit applied');

    const names = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(names.some((name) => /create|add|delete|edit/i.test(name))).toBe(false);
  });
});

describe('audit event detail', () => {
  const ID = '0f5b2c1e-7a4d-4f6e-9c8b-1d2e3f4a5b6c';
  const DETAIL_URL = `${PROXY}/audit-events/${ID}`;

  it('renders the event identity and its version reference', async () => {
    installFetchMock([...baseRoutes(COLLEGE_ADMIN), { url: DETAIL_URL, handler: () => jsonResponse(auditEvent()) }]);

    renderScreen(<AuditDetailScreen eventId={ID} />);

    expect(await screen.findByText('Manual edit applied')).toBeVisible();
    expect(screen.getByText('#502 · V2 · DRAFT')).toBeVisible();
    expect(screen.getByText('ScheduleVersion #502')).toBeVisible();
    expect(screen.getByText('req-9f0f6e3e')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to the audit trail' })).toHaveAttribute(
      'href',
      '/audit',
    );
  });

  it('renders metadata as text', async () => {
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: DETAIL_URL,
        handler: () =>
          jsonResponse(auditEvent({ metadata: { changed_entries: 2, base_version: 501, note: 'swap' } })),
      },
    ]);

    renderScreen(<AuditDetailScreen eventId={ID} />);

    expect(await screen.findByText('changed_entries')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText('swap')).toBeVisible();
  });

  it('states when an event records no metadata', async () => {
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: DETAIL_URL, handler: () => jsonResponse(auditEvent({ metadata: {} })) },
    ]);

    renderScreen(<AuditDetailScreen eventId={ID} />);

    expect(await screen.findByText('This event records no additional metadata.')).toBeVisible();
  });

  it('never interprets a metadata value as markup', async () => {
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: DETAIL_URL,
        handler: () => jsonResponse(auditEvent({ metadata: { note: '<b>not bold</b>' } })),
      },
    ]);

    const { container } = renderScreen(<AuditDetailScreen eventId={ID} />);

    expect(await screen.findByText('<b>not bold</b>')).toBeVisible();
    expect(container.querySelector('b')).toBeNull();
  });

  it('reports a foreign event as not found without revealing it', async () => {
    installFetchMock([
      ...baseRoutes(DEPARTMENT_ADMIN),
      { url: DETAIL_URL, handler: () => jsonResponse({ detail: 'Not found.' }, 404) },
    ]);

    renderScreen(<AuditDetailScreen eventId={ID} />);

    expect(await screen.findByText('Audit event could not be loaded')).toBeVisible();
    expect(screen.getByText(/existence is not revealed/i)).toBeVisible();
  });

  it('refuses the detail page to a role that may not read the trail', async () => {
    installFetchMock(baseRoutes(SCHEDULER));

    renderScreen(<AuditDetailScreen eventId={ID} />);

    expect(await screen.findByText(/The audit trail is not available for your role/i)).toBeVisible();
  });

  it('keeps a removed account readable in the detail view', async () => {
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: DETAIL_URL,
        handler: () =>
          jsonResponse(
            auditEvent({
              actor: { id: null, username_snapshot: 'r.salim', role_snapshot: 'SCHEDULER' },
              department: null,
            }),
          ),
      },
    ]);

    renderScreen(<AuditDetailScreen eventId={ID} />);

    expect(await screen.findByText('r.salim (SCHEDULER)')).toBeVisible();
    expect(screen.getByText(/The account was removed after this event/i)).toBeVisible();
  });
});
