// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '@/components/providers/session-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { VersionWorkflowScreen } from '@/components/scheduling/version-workflow-screen';
import { currentUserPayload, installFetchMock, jsonResponse } from '@/test/fetch-mock';
import {
  BIOAI_DEPARTMENT,
  scheduleVersionDetail,
  scheduleVersionSummary,
} from '@/test/scheduling-fixtures';
import { workflowTransitionResult, workflowValidationResult } from '@/test/f4-fixtures';

const PROXY = '/api/backend';

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

const VERSION_URL = `${PROXY}/schedule-versions/501`;
const HISTORY_URL = `${PROXY}/schedules/300/versions`;
const VALIDATION_URL = `${PROXY}/schedule-versions/501/workflow-validation`;

function renderScreen(element: React.ReactElement) {
  return render(
    <SessionProvider>
      <ToastProvider>{element}</ToastProvider>
    </SessionProvider>,
  );
}

interface VersionOptions {
  status?: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'APPROVED' | 'PUBLISHED';
  scope?: 'DEPARTMENT' | 'COLLEGE';
  isLatest?: boolean;
  validation?: ReturnType<typeof workflowValidationResult>;
}

/** The version routes every workflow test needs, plus its validation call. */
function versionRoutes(account: unknown, options: VersionOptions = {}) {
  const status = options.status ?? 'DRAFT';
  const scope = options.scope ?? 'COLLEGE';
  const versionId = 501;
  const otherId = 502;
  const history = options.isLatest === false
    ? [
        scheduleVersionSummary({ id: otherId, version_number: 2, status: 'DRAFT' }),
        scheduleVersionSummary({ id: versionId, version_number: 1, status }),
      ]
    : [
        scheduleVersionSummary({ id: versionId, version_number: 2, status }),
        scheduleVersionSummary({ id: 500, version_number: 1, status: 'PUBLISHED' }),
      ];

  return [
    { url: '/api/auth/session', handler: () => jsonResponse({ user: account }) },
    {
      url: VERSION_URL,
      handler: () =>
        jsonResponse(
          scheduleVersionDetail({
            id: versionId,
            version_number: options.isLatest === false ? 1 : 2,
            status,
            schedule: {
              id: 300,
              scope,
              semester: { id: 8, number: 1, academic_year: { id: 3, start_year: 2026, end_year: 2027 } },
              department: scope === 'COLLEGE' ? null : BIOAI_DEPARTMENT,
            },
          }),
        ),
    },
    { url: HISTORY_URL, handler: () => jsonResponse(history) },
    {
      url: VALIDATION_URL,
      handler: () => jsonResponse(options.validation ?? workflowValidationResult({ status })),
    },
  ];
}

describe('version workflow screen', () => {
  it('offers a college administrator the publish step on an approved college version', async () => {
    installFetchMock(versionRoutes(COLLEGE_ADMIN, { status: 'APPROVED' }));

    renderScreen(<VersionWorkflowScreen versionId={501} />);

    expect(
      await screen.findByRole('button', { name: 'Publish as official timetable' }),
    ).toBeVisible();
  });

  it('confirms a transition with the scope, semester, version and action named', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...versionRoutes(DEPARTMENT_ADMIN, { status: 'DRAFT', scope: 'DEPARTMENT' }),
      {
        url: `${PROXY}/schedule-versions/501/submit`,
        method: 'POST',
        handler: () => jsonResponse(workflowTransitionResult()),
      },
    ]);

    renderScreen(<VersionWorkflowScreen versionId={501} />);
    await user.click(await screen.findByRole('button', { name: 'Submit for review' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/Department schedule \(BIOAI\)/)).toBeVisible();
    expect(within(dialog).getByText(/2026–2027 · First semester/)).toBeVisible();
    expect(within(dialog).getAllByText(/V2/).length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('button', { name: 'Submit' })).toBeVisible();
  });

  it('posts exactly one action with an empty body and no status field', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...versionRoutes(DEPARTMENT_ADMIN, { status: 'DRAFT', scope: 'DEPARTMENT' }),
      {
        url: `${PROXY}/schedule-versions/501/submit`,
        method: 'POST',
        handler: () => jsonResponse(workflowTransitionResult()),
      },
    ]);

    renderScreen(<VersionWorkflowScreen versionId={501} />);
    await user.click(await screen.findByRole('button', { name: 'Submit for review' }));
    await user.click(
      await within(await screen.findByRole('alertdialog')).findByRole('button', { name: 'Submit' }),
    );

    await waitFor(() => {
      expect(mock.callsTo(`${PROXY}/schedule-versions/501/submit`)).toHaveLength(1);
    });
    const body = JSON.parse(String(mock.callsTo(`${PROXY}/schedule-versions/501/submit`)[0]!.init.body));
    expect(body).toEqual({});
    expect('status' in body).toBe(false);
  });

  it('never chains two stages from one confirmation', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...versionRoutes(DEPARTMENT_ADMIN, { status: 'DRAFT', scope: 'DEPARTMENT' }),
      {
        url: `${PROXY}/schedule-versions/501/submit`,
        method: 'POST',
        handler: () => jsonResponse(workflowTransitionResult()),
      },
    ]);

    renderScreen(<VersionWorkflowScreen versionId={501} />);
    await user.click(await screen.findByRole('button', { name: 'Submit for review' }));
    await user.click(
      await within(await screen.findByRole('alertdialog')).findByRole('button', { name: 'Submit' }),
    );

    await waitFor(() => {
      expect(mock.callsTo(VERSION_URL).length).toBeGreaterThan(1);
    });
    // No review, approve or publish request was made.
    expect(mock.callsTo(`${PROXY}/schedule-versions/501/review`)).toHaveLength(0);
    expect(mock.callsTo(`${PROXY}/schedule-versions/501/approve`)).toHaveLength(0);
    expect(mock.callsTo(`${PROXY}/schedule-versions/501/publish`)).toHaveLength(0);
  });

  it('refuses to offer a transition from a version that is not the newest', async () => {
    installFetchMock(versionRoutes(COLLEGE_ADMIN, { status: 'DRAFT', isLatest: false }));

    renderScreen(<VersionWorkflowScreen versionId={501} />);

    expect(await screen.findByText(/not the newest version/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
  });

  it('offers a department schedule no publish control even when approved', async () => {
    installFetchMock(
      versionRoutes(COLLEGE_ADMIN, { status: 'APPROVED', scope: 'DEPARTMENT' }),
    );

    renderScreen(<VersionWorkflowScreen versionId={501} />);

    expect(await screen.findByText(/never becomes the official timetable/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Publish as official timetable' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('gives a scheduler no review step, because review is a college administrator action', async () => {
    installFetchMock(versionRoutes(SCHEDULER, { status: 'SUBMITTED' }));

    renderScreen(<VersionWorkflowScreen versionId={501} />);

    expect(
      await screen.findByText(/No workflow action is available for your role in this state/i),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mark as reviewed' })).toBeNull();
  });

  it('lets a viewer read the workflow page but offers no action', async () => {
    installFetchMock(versionRoutes(VIEWER, { status: 'DRAFT' }));

    renderScreen(<VersionWorkflowScreen versionId={501} />);

    expect(
      await screen.findByText(/No workflow action is available for your role in this state/i),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
  });

  it('refuses the workflow page to an instructor', async () => {
    installFetchMock(versionRoutes(INSTRUCTOR, { status: 'DRAFT' }));

    renderScreen(<VersionWorkflowScreen versionId={501} />);

    expect(await screen.findByText(/Workflow is not available for your role/i)).toBeVisible();
  });

  it('renders a structured 409 refusal instead of retrying', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...versionRoutes(DEPARTMENT_ADMIN, { status: 'DRAFT', scope: 'DEPARTMENT' }),
      {
        url: `${PROXY}/schedule-versions/501/submit`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              applied: false,
              action: 'submit',
              reason: 'STALE_VERSION',
              message: 'A newer version exists.',
            },
            409,
          ),
      },
    ]);

    renderScreen(<VersionWorkflowScreen versionId={501} />);
    await user.click(await screen.findByRole('button', { name: 'Submit for review' }));
    await user.click(
      await within(await screen.findByRole('alertdialog')).findByRole('button', { name: 'Submit' }),
    );

    expect(await screen.findByText('A newer version exists')).toBeVisible();
    expect(screen.getByText('STALE_VERSION')).toBeVisible();
    expect(screen.getByText(/Nothing was changed\. Refresh this page before acting again/i)).toBeVisible();
  });

  it('renders the refusal of a publish of an empty schedule', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...versionRoutes(COLLEGE_ADMIN, { status: 'APPROVED' }),
      {
        url: `${PROXY}/schedule-versions/501/publish`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              applied: false,
              action: 'publish',
              reason: 'EMPTY_SCHEDULE_CANNOT_BE_PUBLISHED',
              message: '',
            },
            409,
          ),
      },
    ]);

    renderScreen(<VersionWorkflowScreen versionId={501} />);
    await user.click(await screen.findByRole('button', { name: 'Publish as official timetable' }));
    await user.click(
      await within(await screen.findByRole('alertdialog')).findByRole('button', { name: 'Publish' }),
    );

    expect(await screen.findByText('Empty schedule cannot be published')).toBeVisible();
    expect(screen.getByText(/stores no session, so there is nothing to publish/i)).toBeVisible();
  });

  it('shows the workflow validation report and re-runs it on demand', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock(
      versionRoutes(COLLEGE_ADMIN, {
        status: 'APPROVED',
        validation: workflowValidationResult({
          valid: false,
          status: 'APPROVED',
          summary: { entries: 12, errors: 1 },
          issues: [
            {
              code: 'INSTRUCTOR_UNAVAILABLE',
              severity: 'ERROR',
              message: 'Rana Salim is no longer available at that time.',
              entry_id: 900,
              conflicting_entry_id: 902,
            },
          ],
        }),
      }),
    );

    renderScreen(<VersionWorkflowScreen versionId={501} />);

    expect(await screen.findByText('INSTRUCTOR_UNAVAILABLE')).toBeVisible();
    expect(screen.getByText(/no longer available/i)).toBeVisible();
    expect(screen.getByText(/Entry #900/)).toBeVisible();
    expect(screen.getByText(/Conflicts with entry #902/)).toBeVisible();
    // Validation measures the stored version against today's configuration.
    expect(screen.getByText(/today’s configuration/i)).toBeVisible();

    const before = mock.countTo(VALIDATION_URL);
    await user.click(screen.getByRole('button', { name: 'Re-run validation' }));
    await waitFor(() => {
      expect(mock.countTo(VALIDATION_URL)).toBeGreaterThan(before);
    });
  });

  it('distinguishes the publication pointer from the PUBLISHED status', async () => {
    installFetchMock(versionRoutes(COLLEGE_ADMIN, { status: 'PUBLISHED' }));

    renderScreen(<VersionWorkflowScreen versionId={501} />);

    expect(
      await screen.findByText(/the published-version pointer decides which one is official/i),
    ).toBeVisible();
    // A published version offers no further action.
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publish as official timetable' })).toBeNull();
  });

  it('reports a version outside the caller scope as not found', async () => {
    installFetchMock([
      { url: '/api/auth/session', handler: () => jsonResponse({ user: COLLEGE_ADMIN }) },
      { url: VERSION_URL, handler: () => jsonResponse({ detail: 'Not found.' }, 404) },
    ]);

    renderScreen(<VersionWorkflowScreen versionId={501} />);

    expect(await screen.findByText('Version could not be loaded')).toBeVisible();
    expect(screen.getByText(/existence is not revealed/i)).toBeVisible();
  });
});
