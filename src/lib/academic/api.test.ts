import { describe, expect, it } from 'vitest';

import {
  ACADEMIC_ENDPOINTS,
  academicYearsApi,
  collegesApi,
  courseOfferingsApi,
  coursesApi,
  departmentsApi,
  programsApi,
  resourcePath,
  semestersApi,
  stagesApi,
  studentGroupsApi,
  teachingComponentGroupsApi,
  teachingComponentsApi,
} from '@/lib/academic/api';
import { ApiClientError } from '@/lib/api/errors';
import { collegeRow, programRow, teachingComponentRow } from '@/test/academic-fixtures';
import { installFetchMock, jsonResponse } from '@/test/fetch-mock';

const PROXY = '/api/backend';

const ALL_APIS = {
  collegesApi,
  departmentsApi,
  academicYearsApi,
  semestersApi,
  programsApi,
  stagesApi,
  studentGroupsApi,
  coursesApi,
  courseOfferingsApi,
  teachingComponentsApi,
  teachingComponentGroupsApi,
} as const;

describe('academic endpoints', () => {
  it('matches the accepted backend routes', () => {
    expect(ACADEMIC_ENDPOINTS).toEqual({
      colleges: 'colleges',
      departments: 'departments',
      academicYears: 'academic-years',
      semesters: 'semesters',
      programs: 'programs',
      stages: 'stages',
      studentGroups: 'student-groups',
      courses: 'courses',
      courseOfferings: 'course-offerings',
      teachingComponents: 'teaching-components',
      teachingComponentGroups: 'teaching-component-groups',
    });
  });

  it('builds collection and detail paths', () => {
    expect(resourcePath('programs')).toBe('programs');
    expect(resourcePath('programs', 7)).toBe('programs/7');
  });
});

describe('academic reads', () => {
  it('lists colleges through the same-origin proxy', async () => {
    const mock = installFetchMock([
      { url: `${PROXY}/colleges`, handler: () => jsonResponse([collegeRow()]) },
    ]);

    const colleges = await collegesApi.list();

    expect(colleges).toHaveLength(1);
    expect(mock.calls[0]?.url).toBe(`${PROXY}/colleges`);
    expect(mock.calls[0]?.method).toBe('GET');
    // The browser client never attaches credentials of its own.
    expect(
      new Headers(mock.calls[0]?.init.headers as HeadersInit).get('authorization'),
    ).toBeNull();
  });

  it('lists every academic collection', async () => {
    const mock = installFetchMock(
      Object.values(ACADEMIC_ENDPOINTS).map((endpoint) => ({
        url: `${PROXY}/${endpoint}`,
        handler: () => jsonResponse([]),
      })),
    );

    await Promise.all(
      Object.values(ALL_APIS).map((api) =>
        (api as { list: (signal?: AbortSignal) => Promise<unknown[]> }).list(),
      ),
    );

    expect(mock.calls).toHaveLength(Object.keys(ACADEMIC_ENDPOINTS).length);
  });

  it('treats a non-array list payload as an unexpected response', async () => {
    installFetchMock([
      { url: `${PROXY}/programs`, handler: () => jsonResponse({ results: [] }) },
    ]);

    await expect(programsApi.list()).rejects.toMatchObject({
      status: 500,
      code: 'unexpected_response',
    });
  });
});

describe('academic writes', () => {
  it('creates a program with POST', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/programs`,
        method: 'POST',
        handler: () => jsonResponse(programRow(), 201),
      },
    ]);

    const created = await programsApi.create({
      name: 'Biomedical AI',
      code: 'BIOAI',
      study_type: 'UNDERGRADUATE',
      department: 2,
      is_active: true,
    });

    expect(created.id).toBe(4);
    expect(mock.calls[0]?.method).toBe('POST');
    expect(mock.calls[0]?.init.body).toBe(
      JSON.stringify({
        name: 'Biomedical AI',
        code: 'BIOAI',
        study_type: 'UNDERGRADUATE',
        department: 2,
        is_active: true,
      }),
    );
  });

  it('updates with PATCH instead of PUT so partial edits stay partial', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/courses/7`,
        method: 'PATCH',
        handler: () => jsonResponse({ ...programRow(), id: 7 }),
      },
    ]);

    await coursesApi.update(7, { name: 'Machine Learning II' });

    expect(mock.calls[0]?.method).toBe('PATCH');
    expect(mock.calls[0]?.init.body).toBe(JSON.stringify({ name: 'Machine Learning II' }));
  });

  it('sends a status patch for activation changes', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/student-groups/6`,
        method: 'PATCH',
        handler: () => jsonResponse({ id: 6 }, 200),
      },
    ]);

    await studentGroupsApi.update(6, { is_active: false });

    expect(mock.calls[0]?.init.body).toBe(JSON.stringify({ is_active: false }));
  });

  it('does not expose a delete helper anywhere in the academic API', () => {
    for (const [name, api] of Object.entries(ALL_APIS)) {
      expect(Object.keys(api), `${name} must not expose a delete helper`).not.toContain(
        'delete',
      );
      expect(Object.keys(api)).not.toContain('remove');
    }
  });

  it('never issues an HTTP DELETE for any supported operation', async () => {
    const mock = installFetchMock([
      { url: `${PROXY}/courses`, method: 'POST', handler: () => jsonResponse(courseRowStub(), 201) },
      { url: `${PROXY}/courses/7`, method: 'PATCH', handler: () => jsonResponse(courseRowStub()) },
    ]);

    await coursesApi.create({
      name: 'Machine Learning',
      code: 'ML301',
      description: '',
      department: 2,
      is_active: true,
    });
    await coursesApi.update(7, { is_active: false });

    expect(mock.calls.every((call) => call.method !== 'DELETE')).toBe(true);
  });
});

function courseRowStub() {
  return {
    id: 7,
    name: 'Machine Learning',
    code: 'ML301',
    description: '',
    department: { id: 2, name: 'Biomedical AI', code: 'BIOAI' },
    is_active: true,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
  };
}

describe('academic backend errors', () => {
  it('preserves DRF field errors and non-field errors', async () => {
    installFetchMock([
      {
        url: `${PROXY}/programs`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              code: ['Program with this code already exists.'],
              non_field_errors: ['The department does not match the program owner.'],
            },
            400,
          ),
      },
    ]);

    const error = await programsApi
      .create({
        name: 'Biomedical AI',
        code: 'BIOAI',
        study_type: 'UNDERGRADUATE',
        department: 2,
        is_active: true,
      })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiClientError);
    const apiError = (error as ApiClientError).toApiError();
    expect(apiError.status).toBe(400);
    expect(apiError.fieldErrors?.code).toEqual(['Program with this code already exists.']);
    expect(apiError.fieldErrors?.non_field_errors).toEqual([
      'The department does not match the program owner.',
    ]);
  });

  it('keeps the status of authorization and conflict failures', async () => {
    installFetchMock([
      {
        url: `${PROXY}/teaching-components`,
        method: 'POST',
        handler: () =>
          jsonResponse({ detail: 'You may only manage records in your own department.' }, 403),
      },
    ]);

    await expect(
      teachingComponentsApi.create({
        offering: 9,
        component_type: 'THEORY',
        label: '',
        weekly_hours: '3.00',
        session_duration_hours: '1.50',
        is_active: true,
      }),
    ).rejects.toMatchObject({
      status: 403,
      detail: 'You may only manage records in your own department.',
    });
  });

  it('does not leak an internal error body', async () => {
    installFetchMock([
      {
        url: `${PROXY}/teaching-components/10`,
        method: 'PATCH',
        handler: () => jsonResponse({ detail: 'Internal Server Error' }, 500),
      },
    ]);

    const error = await teachingComponentsApi
      .update(10, { is_active: false })
      .catch((cause: unknown) => cause as ApiClientError);

    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).status).toBe(500);
    expect((error as ApiClientError).detail).not.toContain('<html');
  });

  it('reports 404 without inventing information about the record', async () => {
    installFetchMock([
      {
        url: `${PROXY}/teaching-components`,
        handler: () => jsonResponse({ detail: 'Not found.' }, 404),
      },
    ]);

    await expect(teachingComponentsApi.list()).rejects.toMatchObject({
      status: 404,
      detail: 'Not found.',
    });
  });

  it('surfaces a conflict response unchanged', async () => {
    installFetchMock([
      {
        url: `${PROXY}/teaching-component-groups`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              student_group: [
                'A teaching component cannot contain both a group and one of its ancestor groups.',
              ],
            },
            400,
          ),
      },
    ]);

    const error = await teachingComponentGroupsApi
      .create({ teaching_component: 10, student_group: 6 })
      .catch((cause: unknown) => cause as ApiClientError);

    expect((error as ApiClientError).fieldErrors?.student_group?.[0]).toContain('ancestor');
  });
});

describe('read/write representation split', () => {
  it('returns nested summaries for foreign keys while writing ids', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/teaching-components`,
        method: 'POST',
        handler: () => jsonResponse(teachingComponentRow(), 201),
      },
    ]);

    const created = await teachingComponentsApi.create({
      offering: 9,
      component_type: 'THEORY',
      label: 'Lecture A',
      weekly_hours: '3.00',
      session_duration_hours: '1.50',
      is_active: true,
    });

    // The request carries a foreign key id...
    expect(mock.calls[0]?.init.body).toContain('"offering":9');
    // ...and the response carries a nested summary object.
    expect(created.offering).toMatchObject({ id: 9, offering_code: 'MAIN' });
    expect(created.sessions_per_week).toBe(2);
  });
});
