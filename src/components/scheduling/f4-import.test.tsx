// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '@/components/providers/session-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { SemesterPlanImportScreen } from '@/components/scheduling/semester-plan-import-screen';
import { EXPORT_MEDIA_TYPES } from '@/lib/scheduling/exports';
import { IMPORT_ACCEPTED_EXTENSION } from '@/lib/scheduling/constants';
import { currentUserPayload, binaryResponse, installFetchMock, jsonResponse } from '@/test/fetch-mock';
import { BIOAI_DEPARTMENT, CS_DEPARTMENT } from '@/test/scheduling-fixtures';
import { importApplyResult, importIssue, importValidationResult } from '@/test/f4-fixtures';

const PROXY = '/api/backend';
const SESSION_URL = '/api/auth/session';
const TEMPLATE_URL = `${PROXY}/imports/semester-plan/template`;
const VALIDATE_URL = `${PROXY}/imports/semester-plan/validate`;
const APPLY_URL = `${PROXY}/imports/semester-plan/apply`;

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

function workbook(name = 'plan.xlsx', size = 4096): File {
  const file = new File(['x'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  Object.defineProperty(file, 'size', { configurable: true, value: size });
  return file;
}

function baseRoutes(account: unknown) {
  return [
    { url: SESSION_URL, handler: () => jsonResponse({ user: account }) },
    { url: `${PROXY}/departments`, handler: () => jsonResponse(DEPARTMENTS) },
    { url: `${PROXY}/semesters`, handler: () => jsonResponse(SEMESTERS) },
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
 * Choose the department (when the role may choose), the semester, and a workbook.
 * The form only exists once the session has loaded, so its fields are awaited.
 */
async function chooseInputs(user: ReturnType<typeof userEvent.setup>, file = workbook()) {
  await screen.findByLabelText('Semester');
  const department = screen.queryByLabelText('Department');
  if (department) {
    await screen.findByRole('option', { name: 'BIOAI — Biomedical AI' });
    await user.selectOptions(department, '2');
  }
  await user.selectOptions(screen.getByLabelText('Semester'), '8');
  await user.upload(screen.getByLabelText(/Workbook/), file);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('semester plan import', () => {
  it('states what an import does and does not do', async () => {
    installFetchMock(baseRoutes(COLLEGE_ADMIN));

    renderScreen(<SemesterPlanImportScreen />);

    expect(await screen.findByText('Import creates semester teaching-plan setup only.')).toBeVisible();
    expect(screen.getByText('It does not import timetable placements.')).toBeVisible();
    expect(
      screen.getByText('It does not overwrite existing records: the import is create-only.'),
    ).toBeVisible();
    expect(screen.getByText('It does not create instructors or rooms.')).toBeVisible();
  });

  it('downloads the template as an .xlsx file', async () => {
    const user = userEvent.setup();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:mock'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: TEMPLATE_URL,
        handler: () =>
          binaryResponse(new Uint8Array([80, 75]), EXPORT_MEDIA_TYPES.xlsx, {
            'content-disposition': 'attachment; filename="semester_teaching_plan_template.xlsx"',
          }),
      },
    ]);

    renderScreen(<SemesterPlanImportScreen />);
    await user.click(await screen.findByRole('button', { name: 'Download the .xlsx template' }));

    expect(
      await screen.findByText('Downloaded semester_teaching_plan_template.xlsx.'),
    ).toBeVisible();
  });

  it('posts the workbook as multipart with the chosen department and semester', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: VALIDATE_URL,
        method: 'POST',
        handler: () => jsonResponse(importValidationResult({ valid: true, issues: [] })),
      },
    ]);

    renderScreen(<SemesterPlanImportScreen />);
    await chooseInputs(user);
    await user.click(screen.getByRole('button', { name: 'Validate workbook' }));

    await waitFor(() => {
      expect(mock.callsTo(VALIDATE_URL)).toHaveLength(1);
    });
    const body = mock.callsTo(VALIDATE_URL)[0]!.init.body;
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('department')).toBe('2');
    expect(form.get('semester')).toBe('8');
    expect((form.get('file') as File).name).toBe('plan.xlsx');
  });

  it('fixes a department administrator to its own department', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(DEPARTMENT_ADMIN),
      {
        url: VALIDATE_URL,
        method: 'POST',
        handler: () => jsonResponse(importValidationResult({ valid: true, issues: [] })),
      },
    ]);

    renderScreen(<SemesterPlanImportScreen />);

    // No department dropdown is offered, and the fixed value is shown.
    expect(await screen.findByText('BIOAI — Biomedical AI')).toBeVisible();
    expect(screen.queryByLabelText('Department')).toBeNull();

    await chooseInputs(user);
    await user.click(screen.getByRole('button', { name: 'Validate workbook' }));

    await waitFor(() => {
      expect(mock.callsTo(VALIDATE_URL)).toHaveLength(1);
    });
    expect((mock.callsTo(VALIDATE_URL)[0]!.init.body as FormData).get('department')).toBe('2');
  });

  it('refuses the import to a scheduler and a viewer', async () => {
    for (const account of [SCHEDULER, VIEWER]) {
      installFetchMock(baseRoutes(account));

      const { unmount } = renderScreen(<SemesterPlanImportScreen />);
      expect(
        await screen.findByText(/Semester plan import is not available for your role/i),
      ).toBeVisible();
      unmount();
    }
  });

  it('keeps Apply disabled until a workbook has been validated', async () => {
    const user = userEvent.setup();
    installFetchMock(baseRoutes(COLLEGE_ADMIN));

    renderScreen(<SemesterPlanImportScreen />);
    await chooseInputs(user);

    expect(screen.getByRole('button', { name: 'Apply validated import' })).toBeDisabled();
  });

  it('renders blocking errors with their sheet, row and column and keeps Apply disabled', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: VALIDATE_URL, method: 'POST', handler: () => jsonResponse(importValidationResult()) },
    ]);

    renderScreen(<SemesterPlanImportScreen />);
    await chooseInputs(user);
    await user.click(screen.getByRole('button', { name: 'Validate workbook' }));

    expect(await screen.findByText('DUPLICATE_COURSE_CODE')).toBeVisible();
    expect(screen.getByText(/appears twice in this workbook/i)).toBeVisible();
    expect(screen.getByText('courses · row 4 · code')).toBeVisible();
    expect(screen.getByText(/blocking error\(s\) must be fixed/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Apply validated import' })).toBeDisabled();
  });

  it('lets a warning-only validation proceed to apply', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: VALIDATE_URL,
        method: 'POST',
        handler: () =>
          jsonResponse(
            importValidationResult({
              valid: true,
              summary: { sheets: 6, rows: 24, errors: 0, warnings: 1 },
              issues: [
                importIssue({
                  severity: 'WARNING',
                  code: 'GROUP_WITHOUT_STAGE',
                  message: 'A student group has no study stage.',
                }),
              ],
            }),
          ),
      },
      { url: APPLY_URL, method: 'POST', handler: () => jsonResponse(importApplyResult()) },
    ]);

    renderScreen(<SemesterPlanImportScreen />);
    await chooseInputs(user);
    await user.click(screen.getByRole('button', { name: 'Validate workbook' }));

    expect(await screen.findByText(/warning\(s\) will not stop the import/i)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Apply validated import' }));

    expect(await screen.findByText('Import applied')).toBeVisible();
    await waitFor(() => {
      expect(mock.callsTo(APPLY_URL)).toHaveLength(1);
    });
    const form = mock.callsTo(APPLY_URL)[0]!.init.body as FormData;
    expect(form.get('department')).toBe('2');
    expect((form.get('file') as File).name).toBe('plan.xlsx');
  });

  it('reports the created record counts and the warnings of an applied import', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: VALIDATE_URL,
        method: 'POST',
        handler: () =>
          jsonResponse(
            importValidationResult({
              valid: true,
              summary: { sheets: 6, rows: 24, errors: 0, warnings: 1 },
              issues: [],
            }),
          ),
      },
      { url: APPLY_URL, method: 'POST', handler: () => jsonResponse(importApplyResult()) },
    ]);

    renderScreen(<SemesterPlanImportScreen />);
    await chooseInputs(user);
    await user.click(screen.getByRole('button', { name: 'Validate workbook' }));
    await user.click(await screen.findByRole('button', { name: 'Apply validated import' }));

    expect(await screen.findByText('Import applied')).toBeVisible();
    expect(screen.getByText('Courses')).toBeVisible();
    expect(screen.getByText('3')).toBeVisible();
    expect(screen.getByText('Component / group links')).toBeVisible();
    expect(screen.getByText(/nothing existing was updated/i)).toBeVisible();
    expect(screen.getByText('GROUP_WITHOUT_STAGE')).toBeVisible();
  });

  it('discards a validation as soon as the semester changes', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: VALIDATE_URL,
        method: 'POST',
        handler: () => jsonResponse(importValidationResult({ valid: true, issues: [] })),
      },
    ]);

    renderScreen(<SemesterPlanImportScreen />);
    await chooseInputs(user);
    await user.click(screen.getByRole('button', { name: 'Validate workbook' }));
    expect(await screen.findByText('Validation result')).toBeVisible();

    await user.selectOptions(screen.getByLabelText('Semester'), '');

    expect(screen.queryByText('Validation result')).toBeNull();
    expect(screen.getByRole('button', { name: 'Apply validated import' })).toBeDisabled();
  });

  it('discards a validation as soon as another workbook is chosen', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: VALIDATE_URL,
        method: 'POST',
        handler: () => jsonResponse(importValidationResult({ valid: true, issues: [] })),
      },
    ]);

    renderScreen(<SemesterPlanImportScreen />);
    await chooseInputs(user);
    await user.click(screen.getByRole('button', { name: 'Validate workbook' }));
    expect(await screen.findByText('Validation result')).toBeVisible();

    await user.upload(screen.getByLabelText(/Workbook/), workbook('other.xlsx'));

    expect(screen.queryByText('Validation result')).toBeNull();
    expect(screen.getByRole('button', { name: 'Apply validated import' })).toBeDisabled();
  });

  it('refuses an obviously wrong file before any request is made', async () => {
    // `accept` keeps a wrong file out of a normal picker; this drives the guard that
    // still applies when a file reaches the input by another route.
    const user = userEvent.setup({ applyAccept: false });
    const mock = installFetchMock(baseRoutes(COLLEGE_ADMIN));

    renderScreen(<SemesterPlanImportScreen />);
    await screen.findByLabelText('Semester');
    await user.upload(screen.getByLabelText(/Workbook/), workbook('plan.csv'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      `Only ${IMPORT_ACCEPTED_EXTENSION} workbooks are accepted.`,
    );
    expect(screen.getByRole('button', { name: 'Validate workbook' })).toBeDisabled();
    expect(mock.countTo(VALIDATE_URL)).toBe(0);
  });

  it('states that apply re-validates on the server rather than trusting the page', async () => {
    installFetchMock(baseRoutes(COLLEGE_ADMIN));

    renderScreen(<SemesterPlanImportScreen />);

    expect(
      await screen.findByText(/Apply re-reads and fully re-validates the workbook on the server/i),
    ).toBeVisible();
  });

  it('renders a structured 400 refusal with its issues', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      {
        url: VALIDATE_URL,
        method: 'POST',
        handler: () => jsonResponse(importValidationResult({ valid: true, issues: [] })),
      },
      {
        url: APPLY_URL,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              applied: false,
              created: null,
              warnings: [],
              summary: { sheets: 6, rows: 24, errors: 1, warnings: 0 },
              issues: [
                importIssue({
                  code: 'DUPLICATE_COMPONENT',
                  message: 'The same component appears twice.',
                  sheet: 'components',
                  row: 7,
                }),
              ],
            },
            400,
          ),
      },
    ]);

    renderScreen(<SemesterPlanImportScreen />);
    await chooseInputs(user);
    await user.click(screen.getByRole('button', { name: 'Validate workbook' }));
    await user.click(await screen.findByRole('button', { name: 'Apply validated import' }));

    expect(
      await screen.findByText('The workbook was refused and nothing was written'),
    ).toBeVisible();
    expect(screen.getByText('DUPLICATE_COMPONENT')).toBeVisible();
    expect(screen.getByText(/components · row 7/)).toBeVisible();
    expect(screen.queryByText('Import applied')).toBeNull();
  });
});
