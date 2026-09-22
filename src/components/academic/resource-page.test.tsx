// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { ColumnSpec } from '@/components/academic/data-table';
import { AcademicResourcePage, type RowAccess } from '@/components/academic/resource-page';
import { ToastProvider } from '@/components/providers/toast-provider';
import { programsApi } from '@/lib/academic/api';
import {
  buildFormContext,
  programFields,
  programFormValues,
  programPayload,
  type FieldOption,
} from '@/lib/academic/forms';
import type { StudyProgram, StudyProgramWrite } from '@/lib/academic/types';
import { collegeAdmin, programRow } from '@/test/academic-fixtures';
import { installFetchMock, jsonResponse } from '@/test/fetch-mock';

const PROXY = '/api/backend';
const LIST_URL = `${PROXY}/programs`;

const DEPARTMENT_OPTIONS: FieldOption[] = [
  { value: '2', label: 'BIOAI — Biomedical AI' },
];

/** Stable loader: `useCollection` refetches only when the loader identity changes. */
const loadPrograms = (signal: AbortSignal) => programsApi.list(signal);

const COLUMNS: ColumnSpec<StudyProgram>[] = [
  { key: 'code', header: 'Code', render: (program) => program.code },
  { key: 'name', header: 'Name', render: (program) => program.name },
  {
    key: 'status',
    header: 'Status',
    render: (program) => (program.is_active ? 'Active' : 'Inactive'),
  },
];

interface RenderOptions {
  manageable?: (program: StudyProgram) => boolean;
}

function renderPage(options: RenderOptions = {}) {
  const context = buildFormContext(collegeAdmin);
  const fields = programFields(DEPARTMENT_OPTIONS, true);
  return render(
    <ToastProvider>
      <AcademicResourcePage<StudyProgram, StudyProgramWrite>
        title="Study Programs"
        description="Programs offered by a department."
        entityLabel="Study program"
        entityPlural="study programs"
        load={loadPrograms}
        columns={COLUMNS}
        getRowKey={(program) => program.id}
        getRowLabel={(program) => `${program.code} — ${program.name}`}
        searchText={(program) => `${program.code} ${program.name}`}
        hasStatus
        getIsActive={(program) => program.is_active}
        getRowAccess={(program): RowAccess => {
          const manageable = options.manageable ? options.manageable(program) : true;
          return { manageable, badge: manageable ? null : 'read-only' };
        }}
        createAccess={{ allowed: true }}
        createFields={fields}
        editFields={() => fields}
        createFormValues={() => programFormValues(null, context)}
        editFormValues={(program) => programFormValues(program, context)}
        toPayload={programPayload}
        onCreate={(payload) => programsApi.create(payload)}
        onUpdate={(id, payload) => programsApi.update(id, payload)}
      />
    </ToastProvider>,
  );
}

function listRoute(rows: StudyProgram[]) {
  return { url: LIST_URL, handler: () => jsonResponse(rows) };
}

describe('academic resource page — listing', () => {
  it('renders rows with an accessible table caption and row actions', async () => {
    installFetchMock([listRoute([programRow()])]);
    renderPage();

    expect(await screen.findByRole('table', { name: 'Study Programs table' })).toBeVisible();
    expect(screen.getByText('BIOAI')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Edit study program BIOAI — Biomedical AI' }),
    ).toBeVisible();
  });

  it('filters rows with the local search field', async () => {
    const user = userEvent.setup();
    installFetchMock([
      listRoute([
        programRow({ id: 4, code: 'BIOAI', name: 'Biomedical AI' }),
        programRow({
          id: 5,
          code: 'CS101',
          name: 'Computer Science',
          department: { id: 99, name: 'Computer Science', code: 'CS' },
        }),
      ]),
    ]);
    renderPage();

    await screen.findByText('BIOAI');
    await user.type(screen.getByLabelText('Search study programs'), 'CS101');

    expect(screen.getByText('CS101')).toBeVisible();
    expect(screen.queryByText('BIOAI')).toBeNull();
  });

  it('filters rows by status', async () => {
    const user = userEvent.setup();
    installFetchMock([
      listRoute([programRow(), programRow({ id: 5, code: 'CS101', is_active: false })]),
    ]);
    renderPage();

    await screen.findByText('BIOAI');
    await user.selectOptions(screen.getByLabelText('Status'), 'inactive');

    expect(screen.getByText('CS101')).toBeVisible();
    expect(screen.queryByText('BIOAI')).toBeNull();
  });

  it('shows a real empty state when the backend returns nothing', async () => {
    installFetchMock([listRoute([])]);
    renderPage();

    expect(await screen.findByText('No study programs yet.')).toBeVisible();
  });

  it('offers a retry after a load failure', async () => {
    const user = userEvent.setup();
    let attempt = 0;
    installFetchMock([
      {
        url: LIST_URL,
        handler: () => {
          attempt += 1;
          return attempt === 1
            ? jsonResponse({ detail: 'Service unavailable.' }, 503)
            : jsonResponse([programRow()]);
        },
      },
    ]);
    renderPage();

    expect(await screen.findByText('Service unavailable.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('BIOAI')).toBeVisible();
  });
});

describe('academic resource page — create and edit', () => {
  it('creates a record, shows feedback and refreshes the list', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      listRoute([programRow()]),
      {
        url: LIST_URL,
        method: 'POST',
        handler: () => jsonResponse(programRow({ id: 20, code: 'AI401', name: 'Applied AI' }), 201),
      },
    ]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'New study program' }));

    const dialog = screen.getByRole('dialog', { name: 'Create study program' });
    await user.type(within(dialog).getByLabelText(/Name/), 'Applied AI');
    await user.type(within(dialog).getByLabelText(/Code/), 'AI401');
    await user.selectOptions(within(dialog).getByLabelText(/Department/), '2');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mock.callsTo(LIST_URL).some((call) => call.method === 'POST')).toBe(true);
    });

    const post = mock.callsTo(LIST_URL).find((call) => call.method === 'POST');
    expect(post?.init.body).toBe(
      JSON.stringify({
        name: 'Applied AI',
        code: 'AI401',
        study_type: 'UNDERGRADUATE',
        department: 2,
        is_active: true,
      }),
    );

    expect(await screen.findByText('Study program created.')).toBeVisible();
    await waitFor(() => {
      expect(mock.countTo(LIST_URL)).toBeGreaterThanOrEqual(3);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('blocks a submit that fails client validation', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([listRoute([programRow()])]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'New study program' }));
    const dialog = screen.getByRole('dialog', { name: 'Create study program' });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('Name is required.')).toBeVisible();
    expect(within(dialog).getByText('Code is required.')).toBeVisible();
    expect(within(dialog).getByText('Department is required.')).toBeVisible();
    expect(mock.callsTo(LIST_URL).some((call) => call.method === 'POST')).toBe(false);
  });

  it('edits a record with a partial update', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      listRoute([programRow()]),
      {
        url: `${PROXY}/programs/4`,
        method: 'PATCH',
        handler: () => jsonResponse(programRow({ name: 'Biomedical AI II' })),
      },
    ]);
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Edit study program BIOAI — Biomedical AI' }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Edit study program' });
    await user.clear(within(dialog).getByLabelText(/Name/));
    await user.type(within(dialog).getByLabelText(/Name/), 'Biomedical AI II');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mock.countTo(`${PROXY}/programs/4`)).toBe(1);
    });
    expect(mock.callsTo(`${PROXY}/programs/4`)[0]?.init.body).toBe(
      JSON.stringify({
        name: 'Biomedical AI II',
        code: 'BIOAI',
        study_type: 'UNDERGRADUATE',
        department: 2,
        is_active: true,
      }),
    );
    expect(await screen.findByText('Study program updated.')).toBeVisible();
  });
});

describe('academic resource page — lifecycle', () => {
  it('deactivates only after a confirmation that explains it is not a delete', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      listRoute([programRow()]),
      {
        url: `${PROXY}/programs/4`,
        method: 'PATCH',
        handler: () => jsonResponse(programRow({ is_active: false })),
      },
    ]);
    renderPage();

    await user.click(
      await screen.findByRole('button', {
        name: 'Deactivate study program BIOAI — Biomedical AI',
      }),
    );

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/does not delete the record/i)).toBeVisible();
    expect(mock.countTo(`${PROXY}/programs/4`)).toBe(0);

    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(mock.countTo(`${PROXY}/programs/4`)).toBe(1);
    });
    expect(mock.callsTo(`${PROXY}/programs/4`)[0]?.init.body).toBe(
      JSON.stringify({ is_active: false }),
    );
    expect(await screen.findByText('Study program deactivated.')).toBeVisible();
  });

  it('never offers a delete action', async () => {
    installFetchMock([listRoute([programRow()])]);
    renderPage();

    await screen.findByText('BIOAI');
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    expect(screen.getByText(/Records are retired with/i)).toBeVisible();
  });

  it('marks rows the user cannot manage as read only', async () => {
    installFetchMock([listRoute([programRow()])]);
    renderPage({ manageable: () => false });

    expect(await screen.findByText('BIOAI')).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    expect(screen.getByText('Read only')).toBeVisible();
  });
});

describe('academic resource page — backend errors', () => {
  async function submitCreate(): Promise<HTMLElement> {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New study program' }));
    const dialog = screen.getByRole('dialog', { name: 'Create study program' });
    await user.type(within(dialog).getByLabelText(/Name/), 'Applied AI');
    await user.type(within(dialog).getByLabelText(/Code/), 'AI401');
    await user.selectOptions(within(dialog).getByLabelText(/Department/), '2');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    return dialog;
  }

  it('shows a DRF field error next to the control and keeps the form open', async () => {
    installFetchMock([
      listRoute([programRow()]),
      {
        url: LIST_URL,
        method: 'POST',
        handler: () =>
          jsonResponse({ code: ['Program with this code already exists.'] }, 400),
      },
    ]);
    renderPage();

    const dialog = await submitCreate();

    // The message is attached to the offending control...
    const codeInput = within(dialog).getByLabelText(/Code/);
    await waitFor(() => {
      expect(codeInput).toHaveAttribute('aria-invalid', 'true');
    });
    const describedBy = codeInput.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(within(dialog).getAllByText('Program with this code already exists.').length).toBeGreaterThan(0);

    // ...and the panel stays open with the user's input intact.
    expect(screen.getByRole('dialog', { name: 'Create study program' })).toBeVisible();
    expect(within(dialog).getByLabelText(/Name/)).toHaveValue('Applied AI');
  });

  it('shows non-field errors in the error summary', async () => {
    installFetchMock([
      listRoute([programRow()]),
      {
        url: LIST_URL,
        method: 'POST',
        handler: () =>
          jsonResponse(
            { non_field_errors: ['The department does not match the program owner.'] },
            400,
          ),
      },
    ]);
    renderPage();

    const dialog = await submitCreate();

    expect(await within(dialog).findByText('Not accepted:')).toBeVisible();
    expect(
      within(dialog).getAllByText('The department does not match the program owner.').length,
    ).toBeGreaterThan(0);
  });

  it.each([
    [403, 'You do not have permission to perform this action.'],
    [404, 'The requested resource was not found.'],
    [409, 'The request conflicts with the current state.'],
    [500, 'The server encountered an error.'],
  ])('stays stable when the backend answers %i', async (status, expected) => {
    installFetchMock([
      listRoute([programRow()]),
      {
        url: LIST_URL,
        method: 'POST',
        handler: () => jsonResponse({ detail: expected }, status),
      },
    ]);
    renderPage();

    const dialog = await submitCreate();

    expect(await within(dialog).findByText(expected)).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
