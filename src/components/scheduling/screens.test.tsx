// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider } from '@/components/providers/session-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { CompareScreen } from '@/components/scheduling/screens/compare-screen';
import { GenerateScreen } from '@/components/scheduling/screens/generate-screen';
import { ReadinessScreen } from '@/components/scheduling/screens/readiness-screen';
import { ScheduleDetailScreen } from '@/components/scheduling/screens/schedule-detail-screen';
import { SchedulesScreen } from '@/components/scheduling/screens/schedules-screen';
import { SchedulingLandingScreen } from '@/components/scheduling/screens/scheduling-landing-screen';
import { VersionDetailScreen } from '@/components/scheduling/screens/version-detail-screen';
import { currentUserPayload, installFetchMock, jsonResponse, type FetchMock } from '@/test/fetch-mock';
import {
  BIOAI_DEPARTMENT,
  CS_DEPARTMENT,
  collegeGenerationResult,
  departmentGenerationResult,
  generationRejection,
  validationResult,
  scheduleDetail,
  scheduleEntry,
  scheduleSummary,
  scheduleVersionDetail,
  scheduleVersionSummary,
} from '@/test/scheduling-fixtures';

const PROXY = '/api/backend';
const SESSION_URL = '/api/auth/session';

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
const UNASSIGNED_ADMIN = currentUserPayload({ role: 'DEPARTMENT_ADMIN', department: null });

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
  {
    id: 9,
    number: 2,
    start_date: '2027-02-01',
    end_date: '2027-06-15',
    academic_year: { id: 3, start_year: 2026, end_year: 2027 },
    is_active: false,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
  },
];

/** Routes every screen needs before its own call is reached. */
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

async function selectOption(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  await user.selectOptions(await screen.findByLabelText(label), value);
}

function lastCallUrl(mock: FetchMock): string {
  return mock.calls[mock.calls.length - 1]?.url ?? '';
}

describe('readiness screen', () => {
  it('posts a DEPARTMENT scope with the chosen department', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/validate`,
        method: 'POST',
        handler: () => jsonResponse(validationResult({ ready: true, summary: { components_checked: 12, errors: 0, warnings: 2 }, issues: [] })),
      },
    ]);

    renderScreen(<ReadinessScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Run validation' }));

    await waitFor(() => {
      expect(screen.getByText('Configuration is ready for generation.')).toBeVisible();
    });

    const call = mock.calls.find((entry) => entry.url === `${PROXY}/scheduling/validate`);
    expect(JSON.parse(String(call?.init.body))).toEqual({
      semester: 8,
      scope: 'DEPARTMENT',
      department: 2,
    });
  });

  it('omits department when the whole college is validated', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/validate`,
        method: 'POST',
        handler: () => jsonResponse(validationResult({ scope: 'COLLEGE', department: null, ready: true, issues: [], summary: { components_checked: 40, errors: 0, warnings: 0 } })),
      },
    ]);

    renderScreen(<ReadinessScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Scope', 'COLLEGE');
    await user.click(screen.getByRole('button', { name: 'Run validation' }));

    await waitFor(() => {
      expect(screen.getByText('Configuration is ready for generation.')).toBeVisible();
    });

    const call = mock.calls.find((entry) => entry.url === `${PROXY}/scheduling/validate`);
    expect(JSON.parse(String(call?.init.body))).toEqual({ semester: 8, scope: 'COLLEGE' });
  });

  it('does not offer a college scope to a department administrator', async () => {
    const user = userEvent.setup();
    installFetchMock(baseRoutes(DEPARTMENT_ADMIN));

    renderScreen(<ReadinessScreen />);

    await user.click(await screen.findByLabelText('Scope'));
    expect(screen.queryByRole('option', { name: 'Whole college' })).toBeNull();
    expect(screen.getByRole('option', { name: 'One department' })).toBeVisible();
  });

  it('fixes the department of a scheduler and hides the selector', async () => {
    const user = userEvent.setup();
    installFetchMock(baseRoutes(SCHEDULER));

    renderScreen(<ReadinessScreen />);

    await waitFor(() => {
      expect(screen.getByText('BIOAI — Biomedical AI')).toBeVisible();
    });
    expect(screen.queryByLabelText('Department')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Run validation' }));
  });

  it('reports errors and warnings separately and never calls them blockers', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/validate`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            validationResult({
              ready: false,
              summary: { components_checked: 12, errors: 1, warnings: 1 },
              issues: [
                {
                  code: 'MISSING_TEACHING_ASSIGNMENT',
                  severity: 'ERROR',
                  message: 'Teaching component 10 has no instructor.',
                  entity_type: 'TeachingComponent',
                  entity_id: 10,
                  details: { component: 'ML301' },
                },
                {
                  code: 'ROOM_CAPACITY_UNKNOWN',
                  severity: 'WARNING',
                  message: 'Room 22 has no capacity recorded.',
                  entity_type: 'Room',
                  entity_id: 22,
                },
              ],
            }),
          ),
      },
    ]);

    renderScreen(<ReadinessScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Run validation' }));

    await waitFor(() => {
      expect(screen.getByText(/Blocking errors were found/)).toBeVisible();
    });

    expect(screen.getByText('MISSING_TEACHING_ASSIGNMENT')).toBeVisible();
    expect(screen.getByText('ROOM_CAPACITY_UNKNOWN')).toBeVisible();
    expect(screen.getByText('Only ERROR issues block generation. Warnings are informational.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Warnings' }));
    expect(screen.queryByText('MISSING_TEACHING_ASSIGNMENT')).toBeNull();
    expect(screen.getByText('ROOM_CAPACITY_UNKNOWN')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Errors' }));
    expect(screen.getByText('MISSING_TEACHING_ASSIGNMENT')).toBeVisible();
    expect(screen.queryByText('ROOM_CAPACITY_UNKNOWN')).toBeNull();
  });

  it('renders structured issue details without executing them as markup', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/validate`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            validationResult({
              issues: [
                {
                  code: 'INSTRUCTOR_SHARING_MISSING',
                  severity: 'ERROR',
                  message: 'The instructor is not shared with this department.',
                  entity_type: 'InstructorProfile',
                  entity_id: 1,
                  details: { instructor: '<script>alert(1)</script>', required_by: 99, active: true },
                },
              ],
            }),
          ),
      },
    ]);

    renderScreen(<ReadinessScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Run validation' }));

    await waitFor(() => {
      expect(screen.getByText('INSTRUCTOR_SHARING_MISSING')).toBeVisible();
    });

    expect(screen.getByText('<script>alert(1)</script>')).toBeVisible();
    expect(document.querySelector('script')).toBeNull();
  });

  it('shows a restricted state to a viewer', async () => {
    installFetchMock(baseRoutes(VIEWER));

    renderScreen(<ReadinessScreen />);

    expect(
      await screen.findByText('Readiness validation is not available for your role'),
    ).toBeVisible();
  });

  it('shows a restricted state to a department-scoped account with no department', async () => {
    installFetchMock(baseRoutes(UNASSIGNED_ADMIN));

    renderScreen(<ReadinessScreen />);

    expect(
      await screen.findByText('No department is assigned to this account.'),
    ).toBeVisible();
  });
});

describe('generate screen — preview', () => {
  it('renders a solved preview and states that nothing was saved', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () => jsonResponse(departmentGenerationResult()),
      },
    ]);

    renderScreen(<GenerateScreen />);

    expect(await screen.findByText('Preview only. No schedule version is saved.')).toBeVisible();

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Generate preview' }));

    await waitFor(() => {
      expect(screen.getByText('Feasible (valid timetable, optimum not proven)')).toBeVisible();
    });

    const call = mock.calls.find((entry) => entry.url === `${PROXY}/scheduling/generate`);
    expect(JSON.parse(String(call?.init.body))).toEqual({
      semester: 8,
      department: 2,
      max_time_seconds: 30,
    });
  });

  it('labels an optimal solve as optimal and a feasible one as feasible, never the same', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () => jsonResponse(departmentGenerationResult()),
      },
    ]);

    renderScreen(<GenerateScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Generate preview' }));

    await waitFor(() => {
      expect(screen.getByText('Feasible (valid timetable, optimum not proven)')).toBeVisible();
    });
    expect(screen.queryByText('Optimal (optimum proven)')).toBeNull();
  });

  it('shows a college preview with its per-department summary and managing department', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/generate-college`,
        method: 'POST',
        handler: () => jsonResponse(collegeGenerationResult()),
      },
    ]);

    renderScreen(<GenerateScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Scope', 'COLLEGE');
    await user.click(screen.getByRole('button', { name: 'Generate preview' }));

    await waitFor(() => {
      expect(screen.getByText('Optimal (optimum proven)')).toBeVisible();
    });

    expect(screen.getByText('Placements per managing department')).toBeVisible();

    // The managing department is a column of the list representation.
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(await screen.findByRole('columnheader', { name: 'Managing department' })).toBeVisible();

    const call = mock.calls.find((entry) => entry.url === `${PROXY}/scheduling/generate-college`);
    const body = JSON.parse(String(call?.init.body)) as Record<string, unknown>;
    expect(body).toEqual({ semester: 8, max_time_seconds: 60 });
    expect(body).not.toHaveProperty('department');
    expect(body).not.toHaveProperty('scope');
  });

  it('explains a refusal with its structured issues instead of a generic failure', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () => jsonResponse(generationRejection(), 409),
      },
    ]);

    renderScreen(<GenerateScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Generate preview' }));

    await waitFor(() => {
      expect(screen.getByText('Configuration not ready')).toBeVisible();
    });

    expect(screen.getByText('PRE_SCHEDULING_VALIDATION_FAILED')).toBeVisible();
    expect(screen.getByText('INSTRUCTOR_HOURS_EXCEEDED')).toBeVisible();
    expect(screen.queryByText('Generation failed.')).toBeNull();
  });

  it('describes a completed run without a timetable without calling it a crash', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            departmentGenerationResult({
              generated: false,
              placements: [],
              solver: {
                status: 'INFEASIBLE',
                objective_value: null,
                wall_time_seconds: 30,
                num_conflicts: 900,
                num_branches: 5000,
              },
            }),
          ),
      },
    ]);

    renderScreen(<GenerateScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Generate preview' }));

    await waitFor(() => {
      expect(screen.getByText('No timetable produced')).toBeVisible();
    });

    expect(
      screen.getByText(/proved that no timetable exists for the current data/),
    ).toBeVisible();
    expect(screen.queryByText(/server crash/i)).toBeNull();
  });

  it('reports a candidate build refusal as no placement candidates', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            generationRejection({
              reason: 'CANDIDATE_BUILD_FAILED',
              validation: null,
              generation_issues: [
                {
                  code: 'NO_PLACEMENT_CANDIDATES',
                  severity: 'ERROR',
                  message: 'Session tc-10#s1 has no candidate.',
                  entity_type: 'Session',
                  entity_id: null,
                },
              ],
            }),
            409,
          ),
      },
    ]);

    renderScreen(<GenerateScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Generate preview' }));

    await waitFor(() => {
      expect(screen.getByText('No placement candidates')).toBeVisible();
    });
    expect(screen.getByText('NO_PLACEMENT_CANDIDATES')).toBeVisible();
  });

  it('shows an invalid request as a rejected field, not as a solver failure', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () =>
          jsonResponse({ max_time_seconds: ['Ensure this value is less than or equal to 120.'] }, 400),
      },
    ]);

    renderScreen(<GenerateScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Generate preview' }));

    await waitFor(() => {
      expect(screen.getByText('Request invalid')).toBeVisible();
    });
    expect(screen.getByText('max_time_seconds')).toBeVisible();
  });

  it('keeps the time limit inside the documented department range', async () => {
    installFetchMock(baseRoutes(COLLEGE_ADMIN));
    renderScreen(<GenerateScreen />);

    const input = await screen.findByLabelText('Solver time limit (seconds, optional)');

    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '120');
    expect(input).toHaveValue(30);
  });

  it('offers nothing but the time limit as a solver control', async () => {
    installFetchMock(baseRoutes(COLLEGE_ADMIN));
    renderScreen(<GenerateScreen />);

    expect(await screen.findByLabelText('Solver time limit (seconds, optional)')).toBeVisible();
    expect(screen.queryByLabelText(/seed/i)).toBeNull();
    expect(screen.queryByLabelText(/worker/i)).toBeNull();
    expect(screen.queryByLabelText(/logging/i)).toBeNull();
    expect(screen.queryByLabelText(/reservation/i)).toBeNull();
  });

  it('hides the college scope from a scheduler', async () => {
    const user = userEvent.setup();
    installFetchMock(baseRoutes(SCHEDULER));
    renderScreen(<GenerateScreen />);

    await user.click(await screen.findByLabelText('Scope'));
    expect(screen.queryByRole('option', { name: 'Whole college' })).toBeNull();
  });
});

describe('generate screen — draft persistence', () => {
  it('calls the generation-and-persist endpoint separately and never sends a preview placement', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () => jsonResponse(departmentGenerationResult()),
      },
      {
        url: `${PROXY}/schedules/generate-department-draft`,
        method: 'POST',
        handler: () =>
          jsonResponse({
            ...departmentGenerationResult({ persisted: true }),
            scope: 'DEPARTMENT',
            schedule: scheduleSummary(),
            version: scheduleVersionSummary({ version_number: 3 }),
          }),
      },
    ]);

    renderScreen(<GenerateScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Generate preview' }));
    await waitFor(() => {
      expect(screen.getByText('Feasible (valid timetable, optimum not proven)')).toBeVisible();
    });

    await user.type(screen.getByLabelText(/Notes/), 'Weekly check');
    await user.click(screen.getByRole('button', { name: 'Generate & Save New Draft' }));

    await waitFor(() => {
      expect(screen.getByText('New immutable draft version created.')).toBeVisible();
    });

    expect(mock.calls.filter((call) => call.url === `${PROXY}/scheduling/generate`)).toHaveLength(1);
    const draftCall = mock.calls.find(
      (call) => call.url === `${PROXY}/schedules/generate-department-draft`,
    );
    const body = JSON.parse(String(draftCall?.init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      semester: 8,
      department: 2,
      max_time_seconds: 30,
      notes: 'Weekly check',
    });
    expect(body).not.toHaveProperty('placements');
    expect(body).not.toHaveProperty('version_number');
  });

  it('uses the version number the server returned', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/schedules/generate-department-draft`,
        method: 'POST',
        handler: () =>
          jsonResponse({
            ...departmentGenerationResult({ persisted: true }),
            scope: 'DEPARTMENT',
            schedule: scheduleSummary({ version_count: 3, latest_version_number: 3 }),
            version: scheduleVersionSummary({ id: 503, version_number: 3 }),
          }),
      },
    ]);

    renderScreen(<GenerateScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Generate & Save New Draft' }));

    await waitFor(() => {
      expect(screen.getByText('New immutable draft version created.')).toBeVisible();
    });

    expect(screen.getByText(/Version 3 of Department/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'View version' })).toHaveAttribute(
      'href',
      '/scheduling/versions/503',
    );
    expect(screen.getByRole('link', { name: 'View history' })).toHaveAttribute(
      'href',
      '/scheduling/schedules/300',
    );
  });

  it('explains that a draft is a fresh server-side run, not a saved preview', async () => {
    installFetchMock(baseRoutes(COLLEGE_ADMIN));
    renderScreen(<GenerateScreen />);

    expect(
      await screen.findByText(
        'The server performs a new validated generation run and stores its result as the next immutable draft version.',
      ),
    ).toBeVisible();
    expect(screen.queryByText(/Save this preview/)).toBeNull();
    expect(screen.queryByText(/Persist these placements/)).toBeNull();
  });

  it('caps the notes field at the documented length', async () => {
    installFetchMock(baseRoutes(COLLEGE_ADMIN));
    renderScreen(<GenerateScreen />);

    const notes = await screen.findByLabelText(/Notes/);
    expect(notes).toHaveAttribute('maxlength', '2000');
  });

  it('reports nothing stored when a completed draft was not persisted', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/schedules/generate-department-draft`,
        method: 'POST',
        handler: () =>
          jsonResponse({
            ...departmentGenerationResult({ generated: false, persisted: false, placements: [] }),
            scope: 'DEPARTMENT',
            schedule: null,
            version: null,
            solver: {
              status: 'INFEASIBLE',
              objective_value: null,
              wall_time_seconds: 30,
              num_conflicts: 9,
              num_branches: 40,
            },
          }),
      },
    ]);

    renderScreen(<GenerateScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Generate & Save New Draft' }));

    await waitFor(() => {
      expect(screen.getByText('No timetable produced')).toBeVisible();
    });
    expect(screen.queryByText('New immutable draft version created.')).toBeNull();
  });

  it('reports an incomplete persistence result as refused', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/schedules/generate-department-draft`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            { ...generationRejection({ reason: 'GENERATION_RESULT_INCOMPLETE' }), scope: 'DEPARTMENT' },
            409,
          ),
      },
    ]);

    renderScreen(<GenerateScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Department', '2');
    await user.click(screen.getByRole('button', { name: 'Generate & Save New Draft' }));

    await waitFor(() => {
      expect(screen.getByText('Generation result incomplete')).toBeVisible();
    });
    expect(screen.queryByText('New immutable draft version created.')).toBeNull();
  });

  it('lets a college administrator persist a college draft without a department', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/schedules/generate-college-draft`,
        method: 'POST',
        handler: () =>
          jsonResponse({
            ...collegeGenerationResult({ persisted: true }),
            schedule: scheduleSummary({ scope: 'COLLEGE', department: null }),
            version: scheduleVersionSummary({ id: 600 }),
          }),
      },
    ]);

    renderScreen(<GenerateScreen />);

    await selectOption(user, 'Semester', '8');
    await selectOption(user, 'Scope', 'COLLEGE');
    await user.click(screen.getByRole('button', { name: 'Generate & Save New Draft' }));

    await waitFor(() => {
      expect(screen.getByText('New immutable draft version created.')).toBeVisible();
    });

    const call = mock.calls.find(
      (entry) => entry.url === `${PROXY}/schedules/generate-college-draft`,
    );
    const body = JSON.parse(String(call?.init.body)) as Record<string, unknown>;
    expect(body).toEqual({ semester: 8, max_time_seconds: 60, notes: '' });
    expect(body).not.toHaveProperty('department');
  });
});

describe('schedule history', () => {
  it('lists persisted schedules with their version counts and calls no mutation endpoint', async () => {
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/schedules`,
        handler: () =>
          jsonResponse([
            scheduleSummary(),
            scheduleSummary({
              id: 301,
              scope: 'COLLEGE',
              department: null,
              semester: { id: 9, number: 2, academic_year: { id: 3, start_year: 2026, end_year: 2027 } },
              version_count: 1,
              latest_version_number: 1,
              latest_version_status: 'SUBMITTED',
            }),
          ]),
      },
    ]);

    renderScreen(<SchedulesScreen />);

    const table = await screen.findByRole('table', { name: 'Persisted schedules' });

    expect(within(table).getByText('BIOAI')).toBeVisible();
    // A college schedule states its scope in the scope column and in the
    // department column; neither invents a department code.
    expect(within(table).getAllByText('College-wide')).toHaveLength(2);
    expect(within(table).getByText('V2')).toBeVisible();
    expect(within(table).getByText('Submitted')).toBeVisible();
    expect(within(table).getByText('2026–2027 · First semester')).toBeVisible();
    // The nested semester summary of a schedule carries no active flag, so the
    // list states the identity and does not invent a status for it.
    expect(within(table).getByText('2026–2027 · Second semester')).toBeVisible();

    for (const call of mock.calls) {
      expect(['GET', 'POST']).toContain(call.method);
      expect(call.url.startsWith(`${PROXY}/schedules`) || call.url === SESSION_URL || call.url.startsWith(`${PROXY}/semesters`) || call.url.startsWith(`${PROXY}/departments`)).toBe(true);
      expect(call.init.method ?? 'GET').not.toBe('DELETE');
    }
  });

  it('never sends an undocumented filter', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: `${PROXY}/schedules`, handler: () => jsonResponse([scheduleSummary()]) },
      { url: `${PROXY}/schedules?semester=8&scope=DEPARTMENT&department=2`, handler: () => jsonResponse([scheduleSummary()]) },
    ]);

    renderScreen(<SchedulesScreen />);

    await screen.findByRole('table', { name: 'Persisted schedules' });

    await selectOption(user, 'Semester (optional)', '8');
    await selectOption(user, 'Scope (optional)', 'DEPARTMENT');
    await selectOption(user, 'Department (optional)', '2');

    await waitFor(() => {
      expect(lastCallUrl(mock)).toBe(
        `${PROXY}/schedules?semester=8&scope=DEPARTMENT&department=2`,
      );
    });
  });

  it('lets a viewer read the collection without any generation control', async () => {
    installFetchMock([
      ...baseRoutes(VIEWER),
      { url: `${PROXY}/schedules`, handler: () => jsonResponse([scheduleSummary()]) },
    ]);

    renderScreen(<SchedulesScreen />);

    expect(await screen.findByRole('table', { name: 'Persisted schedules' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Generate/ })).toBeNull();
  });

  it('shows an empty state when nothing is stored', async () => {
    installFetchMock([
      ...baseRoutes(VIEWER),
      { url: `${PROXY}/schedules`, handler: () => jsonResponse([]) },
    ]);

    renderScreen(<SchedulesScreen />);

    expect(await screen.findByText(/No persisted schedule matches these filters/)).toBeVisible();
  });
});

describe('schedule detail', () => {
  it('shows identity, the newest version and the history without workflow controls', async () => {
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: `${PROXY}/schedules/300`, handler: () => jsonResponse(scheduleDetail()) },
      {
        url: `${PROXY}/schedules/300/versions`,
        handler: () =>
          jsonResponse([
            scheduleVersionSummary({ id: 502, version_number: 2 }),
            scheduleVersionSummary({ id: 501, version_number: 1, status: 'PUBLISHED' }),
          ]),
      },
    ]);

    renderScreen(<ScheduleDetailScreen scheduleId={300} />);

    expect(await screen.findByText('Schedule identity')).toBeVisible();
    expect(screen.getByText('No version of this schedule is published.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open V2' })).toHaveAttribute(
      'href',
      '/scheduling/versions/502',
    );

    const history = screen.getByRole('table', { name: 'Schedule versions' });
    expect(within(history).getAllByRole('row')).toHaveLength(3);
    expect(within(history).getByText('Published')).toBeVisible();
    expect(within(history).getAllByText('Department generation')).toHaveLength(2);

    expect(screen.queryByRole('button', { name: /Submit|Approve|Publish|Review/ })).toBeNull();
  });

  it('shows the publication pointer when the backend reports one', async () => {
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/schedules/300`,
        handler: () =>
          jsonResponse(
            scheduleDetail({
              scope: 'COLLEGE',
              department: null,
              published_version: 501,
              published_version_number: 1,
              published_at: '2026-09-05T12:00:00Z',
            }),
          ),
      },
      { url: `${PROXY}/schedules/300/versions`, handler: () => jsonResponse([]) },
    ]);

    renderScreen(<ScheduleDetailScreen scheduleId={300} />);

    expect(await screen.findByText('Published pointer')).toBeVisible();
    expect(screen.getByText('V1')).toBeVisible();
    expect(screen.getByText('2026-09-05 12:00')).toBeVisible();
    expect(screen.getAllByText('College-wide').length).toBeGreaterThanOrEqual(2);
  });

  it('does not reveal a schedule outside the caller scope', async () => {
    installFetchMock([
      ...baseRoutes(DEPARTMENT_ADMIN),
      { url: `${PROXY}/schedules/999`, handler: () => jsonResponse({ detail: 'Not found.' }, 404) },
      { url: `${PROXY}/schedules/999/versions`, handler: () => jsonResponse([]) },
    ]);

    renderScreen(<ScheduleDetailScreen scheduleId={999} />);

    expect(await screen.findByText('Schedule could not be loaded')).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Schedule versions' })).toBeNull();
  });
});

describe('version detail', () => {
  it('renders the stored snapshot values and ignores a later rename of the live record', async () => {
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: `${PROXY}/schedule-versions/501`, handler: () => jsonResponse(scheduleVersionDetail()) },
      {
        url: `${PROXY}/schedule-versions/501/entries`,
        handler: () => jsonResponse([scheduleEntry()]),
      },
      {
        // The live course was renamed after the version was stored.
        url: `${PROXY}/courses`,
        handler: () =>
          jsonResponse([
            { id: 7, name: 'Machine Learning (renamed live)', code: 'ML301', description: '', department: BIOAI_DEPARTMENT, is_active: true, created_at: '', updated_at: '' },
          ]),
      },
    ]);

    renderScreen(<VersionDetailScreen versionId={501} />);

    expect(await screen.findByText('Stored timetable')).toBeVisible();
    expect(screen.getByText(/Machine Learning \(stored snapshot\)/)).toBeVisible();
    expect(screen.queryByText(/renamed live/)).toBeNull();
    expect(screen.getByText(/Rana Salim \(stored snapshot\)/)).toBeVisible();
  });

  it('shows generation provenance, solver metadata and workflow timestamps', async () => {
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/schedule-versions/501`,
        handler: () =>
          jsonResponse(
            scheduleVersionDetail({
              status: 'APPROVED',
              parent_version: 500,
              submitted_by: { id: 7, username: 'r.salim', role: 'SCHEDULER' },
              submitted_at: '2026-09-02T09:00:00Z',
              approved_by: { id: 9, username: 'a.hassan', role: 'COLLEGE_ADMIN' },
              approved_at: '2026-09-03T11:30:00Z',
            }),
          ),
      },
      { url: `${PROXY}/schedule-versions/501/entries`, handler: () => jsonResponse([]) },
    ]);

    renderScreen(<VersionDetailScreen versionId={501} />);

    expect(await screen.findByText('Version provenance')).toBeVisible();
    expect(screen.getByText('Approved')).toBeVisible();
    expect(screen.getAllByText('Department generation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Feasible (valid timetable, optimum not proven)')).toBeVisible();
    expect(screen.getByText('3.5 s')).toBeVisible();
    expect(screen.getByText('r.salim · 2026-09-02 09:00')).toBeVisible();
    expect(screen.getByText('a.hassan · 2026-09-03 11:30')).toBeVisible();
    expect(screen.getByText('Not current')).toBeVisible();
  });

  it('reports a manual version without inventing solver metadata', async () => {
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: `${PROXY}/schedule-versions/501`,
        handler: () =>
          jsonResponse(
            scheduleVersionDetail({
              source: 'MANUAL_EDIT',
              solver_status: null,
              objective_value: null,
              solver_wall_time_seconds: null,
              solver_num_conflicts: null,
              solver_num_branches: null,
            }),
          ),
      },
      { url: `${PROXY}/schedule-versions/501/entries`, handler: () => jsonResponse([]) },
    ]);

    renderScreen(<VersionDetailScreen versionId={501} />);

    expect(
      await screen.findByText('No solver run is recorded for this version.'),
    ).toBeVisible();
    expect(screen.getByText('Manual edit')).toBeVisible();
  });

  it('offers no mutation control on a stored version', async () => {
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: `${PROXY}/schedule-versions/501`, handler: () => jsonResponse(scheduleVersionDetail()) },
      { url: `${PROXY}/schedule-versions/501/entries`, handler: () => jsonResponse([scheduleEntry()]) },
    ]);

    renderScreen(<VersionDetailScreen versionId={501} />);

    await screen.findByText('Stored timetable');
    expect(screen.queryByRole('button', { name: /Edit|Delete|Move|Submit|Publish/i })).toBeNull();
  });
});

describe('version comparison screen', () => {
  it('compares two versions of one schedule and reports the differences', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: `${PROXY}/schedules`, handler: () => jsonResponse([scheduleSummary()]) },
      {
        url: `${PROXY}/schedules/300/versions`,
        handler: () =>
          jsonResponse([
            scheduleVersionSummary({ id: 502, version_number: 2 }),
            scheduleVersionSummary({ id: 501, version_number: 1 }),
          ]),
      },
      {
        url: `${PROXY}/schedule-versions/501/entries`,
        handler: () => jsonResponse([scheduleEntry({ session_id: 'tc-10#s1' })]),
      },
      {
        url: `${PROXY}/schedule-versions/502/entries`,
        handler: () =>
          jsonResponse([
            scheduleEntry({
              id: 901,
              session_id: 'tc-10#s1',
              room: { id: 23, code: 'CS-201', name: 'Computer Lab' },
            }),
            scheduleEntry({ id: 902, session_id: 'tc-11#s1' }),
          ]),
      },
    ]);

    renderScreen(<CompareScreen />);

    await selectOption(user, 'Schedule', '300');
    await selectOption(user, 'Base version', '501');
    await selectOption(user, 'Comparison version', '502');
    await user.click(screen.getByRole('button', { name: 'Compare versions' }));

    await waitFor(() => {
      expect(screen.getByText('Room changed (1)')).toBeVisible();
    });

    expect(screen.getByText('Added (1)')).toBeVisible();
    expect(screen.getAllByText('Before').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('After').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/CS-201/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Apply|Save|Move/i })).toBeNull();
  });

  it('asks for one schedule first when several exist', async () => {
    installFetchMock([
      ...baseRoutes(VIEWER),
      { url: `${PROXY}/schedules`, handler: () => jsonResponse([scheduleSummary()]) },
    ]);

    renderScreen(<CompareScreen />);

    expect(await screen.findByLabelText('Schedule')).toBeVisible();
    expect(screen.queryByLabelText('Base version')).toBeNull();
  });

  it('states that two versions are needed when only one is stored', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(VIEWER),
      { url: `${PROXY}/schedules`, handler: () => jsonResponse([scheduleSummary()]) },
      {
        url: `${PROXY}/schedules/300/versions`,
        handler: () => jsonResponse([scheduleVersionSummary({ id: 501, version_number: 1 })]),
      },
    ]);

    renderScreen(<CompareScreen />);

    await selectOption(user, 'Schedule', '300');

    expect(
      await screen.findByText(/Comparison needs two versions of the same schedule/),
    ).toBeVisible();
  });
});

describe('landing page', () => {
  it('offers the operational actions to a scheduler', async () => {
    installFetchMock(baseRoutes(SCHEDULER));

    renderScreen(<SchedulingLandingScreen />);

    expect(await screen.findByRole('link', { name: 'Check Readiness' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Generate Preview' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Generate & Save Draft' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Schedule History' })).toBeVisible();
    expect(screen.queryByText(/statistics/i)).toBeNull();
  });

  it('offers a viewer history only', async () => {
    installFetchMock(baseRoutes(VIEWER));

    renderScreen(<SchedulingLandingScreen />);

    expect(await screen.findByRole('link', { name: 'Schedule History' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Check Readiness' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Generate Preview' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Generate & Save Draft' })).toBeNull();
  });
});
