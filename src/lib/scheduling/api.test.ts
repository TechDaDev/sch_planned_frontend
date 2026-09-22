import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@/lib/api/errors';
import {
  SCHEDULING_ENDPOINTS,
  asGenerationRejection,
  collegeDraftApi,
  collegeGenerationApi,
  departmentDraftApi,
  departmentGenerationApi,
  hasGenerationRejectionReason,
  scheduleVersionsApi,
  schedulesApi,
  validationApi,
} from '@/lib/scheduling/api';
import {
  collegeGenerationResult,
  departmentGenerationResult,
  generationRejection,
  placement,
  scheduleDetail,
  scheduleEntry,
  scheduleSummary,
  scheduleVersionDetail,
  scheduleVersionSummary,
  validationResult,
  BIOAI_DEPARTMENT,
} from '@/test/scheduling-fixtures';
import { installFetchMock, jsonResponse } from '@/test/fetch-mock';

const PROXY = '/api/backend';

/** Sends `init` as the request body, so a test can assert the exact payload. */
function bodyOf(init: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>;
}

describe('scheduling endpoints', () => {
  it('matches the accepted backend routes', () => {
    expect(SCHEDULING_ENDPOINTS).toEqual({
      validate: 'scheduling/validate',
      generateDepartment: 'scheduling/generate',
      generateCollege: 'scheduling/generate-college',
      schedules: 'schedules',
      generateDepartmentDraft: 'schedules/generate-department-draft',
      generateCollegeDraft: 'schedules/generate-college-draft',
      scheduleVersions: 'schedule-versions',
    });
  });

  it('maps one to one onto the documented Django routes', () => {
    // Django defines each of these with a trailing slash, which the BFF proxy
    // re-adds when it builds the upstream URL (`buildBackendUrl`).
    expect(Object.values(SCHEDULING_ENDPOINTS).map((endpoint) => `${endpoint}/`)).toEqual([
      'scheduling/validate/',
      'scheduling/generate/',
      'scheduling/generate-college/',
      'schedules/',
      'schedules/generate-department-draft/',
      'schedules/generate-college-draft/',
      'schedule-versions/',
    ]);
  });
});

describe('readiness validation calls', () => {
  it('posts a DEPARTMENT scope with the department id', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/scheduling/validate`,
        method: 'POST',
        handler: () => jsonResponse(validationResult()),
      },
    ]);

    const result = await validationApi.run({
      semester: 8,
      scope: 'DEPARTMENT',
      department: BIOAI_DEPARTMENT.id,
    });

    expect(result.scope).toBe('DEPARTMENT');
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.method).toBe('POST');
    expect(bodyOf(mock.calls[0]!.init)).toEqual({
      semester: 8,
      scope: 'DEPARTMENT',
      department: 2,
    });
  });

  it('omits department entirely for a COLLEGE scope', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/scheduling/validate`,
        method: 'POST',
        handler: () => jsonResponse(validationResult({ scope: 'COLLEGE', department: null })),
      },
    ]);

    await validationApi.run({ semester: 8, scope: 'COLLEGE' });

    expect(bodyOf(mock.calls[0]!.init)).toEqual({ semester: 8, scope: 'COLLEGE' });
  });

  it('never sends an undocumented key', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/scheduling/validate`,
        method: 'POST',
        handler: () => jsonResponse(validationResult()),
      },
    ]);

    await validationApi.run({ semester: 8, scope: 'DEPARTMENT', department: 2 });

    const payload = bodyOf(mock.calls[0]!.init);
    expect(Object.keys(payload).sort()).toEqual(['department', 'scope', 'semester']);
  });
});

describe('preview generation calls', () => {
  it('posts a department preview to scheduling/generate/', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () => jsonResponse(departmentGenerationResult()),
      },
    ]);

    const result = await departmentGenerationApi.preview({
      semester: 8,
      department: 2,
      max_time_seconds: 30,
    });

    expect(result.persisted).toBe(false);
    expect(mock.calls[0]?.url).toBe(`${PROXY}/scheduling/generate`);
    expect(bodyOf(mock.calls[0]!.init)).toEqual({
      semester: 8,
      department: 2,
      max_time_seconds: 30,
    });
  });

  it('posts a college preview without department or scope, and with no solver control', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/scheduling/generate-college`,
        method: 'POST',
        handler: () => jsonResponse(collegeGenerationResult()),
      },
    ]);

    await collegeGenerationApi.preview({ semester: 8, max_time_seconds: 60 });

    const payload = bodyOf(mock.calls[0]!.init);
    expect(payload).toEqual({ semester: 8, max_time_seconds: 60 });
    expect(payload).not.toHaveProperty('department');
    expect(payload).not.toHaveProperty('scope');
    expect(payload).not.toHaveProperty('random_seed');
    expect(payload).not.toHaveProperty('num_search_workers');
    expect(payload).not.toHaveProperty('reservations');
    expect(payload).not.toHaveProperty('placements');
  });
});

describe('draft generation calls', () => {
  it('posts a department draft with notes and never a placement', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/schedules/generate-department-draft`,
        method: 'POST',
        handler: () =>
          jsonResponse({
            ...departmentGenerationResult({ persisted: true }),
            scope: 'DEPARTMENT',
            schedule: scheduleSummary(),
            version: scheduleVersionSummary(),
          }),
      },
    ]);

    const result = await departmentDraftApi.create({
      semester: 8,
      department: 2,
      max_time_seconds: 30,
      notes: 'First draft',
    });

    expect(result.persisted).toBe(true);
    expect(result.version?.version_number).toBe(1);
    const payload = bodyOf(mock.calls[0]!.init);
    expect(payload).toEqual({
      semester: 8,
      department: 2,
      max_time_seconds: 30,
      notes: 'First draft',
    });
    expect(payload).not.toHaveProperty('placements');
    expect(payload).not.toHaveProperty('version_number');
    expect(payload).not.toHaveProperty('status');
  });

  it('posts a college draft without department', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/schedules/generate-college-draft`,
        method: 'POST',
        handler: () => jsonResponse(collegeGenerationResult({ persisted: true })),
      },
    ]);

    await collegeDraftApi.create({ semester: 8, max_time_seconds: 60, notes: '' });

    const payload = bodyOf(mock.calls[0]!.init);
    expect(payload).toEqual({ semester: 8, max_time_seconds: 60, notes: '' });
    expect(payload).not.toHaveProperty('department');
    expect(payload).not.toHaveProperty('scope');
  });
});

describe('persisted read calls', () => {
  it('lists schedules with only the documented filters', async () => {
    const mock = installFetchMock([
      { url: `${PROXY}/schedules?semester=8&scope=DEPARTMENT`, handler: () => jsonResponse([scheduleSummary()]) },
    ]);

    const schedules = await schedulesApi.list({ semester: 8, scope: 'DEPARTMENT' });

    expect(schedules).toHaveLength(1);
    expect(mock.calls[0]?.url).toBe(`${PROXY}/schedules?semester=8&scope=DEPARTMENT`);
  });

  it('omits a filter that is not set', async () => {
    const mock = installFetchMock([
      { url: `${PROXY}/schedules`, handler: () => jsonResponse([]) },
    ]);

    await schedulesApi.list({});

    expect(mock.calls[0]?.url).toBe(`${PROXY}/schedules`);
  });

  it('reads one schedule and its version history', async () => {
    const mock = installFetchMock([
      { url: `${PROXY}/schedules/300`, handler: () => jsonResponse(scheduleDetail()) },
      {
        url: `${PROXY}/schedules/300/versions`,
        handler: () => jsonResponse([scheduleVersionSummary({ version_number: 2 }), scheduleVersionSummary()]),
      },
    ]);

    const detail = await schedulesApi.get(300);
    const versions = await schedulesApi.versions(300);

    expect(detail.id).toBe(300);
    expect(versions.map((version) => version.version_number)).toEqual([2, 1]);
    expect(mock.calls[0]?.url).toBe(`${PROXY}/schedules/300`);
    expect(mock.calls[1]?.url).toBe(`${PROXY}/schedules/300/versions`);
  });

  it('reads one version and its entries', async () => {
    installFetchMock([
      { url: `${PROXY}/schedule-versions/501`, handler: () => jsonResponse(scheduleVersionDetail()) },
      {
        url: `${PROXY}/schedule-versions/501/entries`,
        handler: () => jsonResponse([scheduleEntry()]),
      },
    ]);

    const version = await scheduleVersionsApi.get(501);
    const entries = await scheduleVersionsApi.entries(501);

    expect(version.id).toBe(501);
    expect(entries[0]?.session_id).toBe('tc-10#s1');
  });

  it('sends only documented entry filters', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/entries?room=22&day_of_week=1`,
        handler: () => jsonResponse([scheduleEntry()]),
      },
    ]);

    await scheduleVersionsApi.entries(501, { room: 22, day_of_week: 1 });

    expect(mock.calls[0]?.url).toBe(
      `${PROXY}/schedule-versions/501/entries?room=22&day_of_week=1`,
    );
  });
});

describe('no mutation surface exists for schedules or versions', () => {
  it('exposes only list, get and versions on the schedule API', () => {
    expect(Object.keys(schedulesApi).sort()).toEqual(['get', 'list', 'versions']);
  });

  it('exposes only get and entries on the version API', () => {
    expect(Object.keys(scheduleVersionsApi).sort()).toEqual(['entries', 'get']);
  });
});

describe('generation refusal payloads', () => {
  it('keeps the structured 409 body reachable through the client error', async () => {
    installFetchMock([
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () => jsonResponse(generationRejection(), 409),
      },
    ]);

    let caught: unknown = null;
    try {
      await departmentGenerationApi.preview({ semester: 8, department: 2 });
    } catch (cause) {
      caught = cause;
    }

    expect(caught).toBeInstanceOf(ApiClientError);
    const error = caught as ApiClientError;
    expect(error.status).toBe(409);
    expect(hasGenerationRejectionReason(error.payload)).toBe(true);
    const rejection = asGenerationRejection(error.payload);
    expect(rejection?.reason).toBe('PRE_SCHEDULING_VALIDATION_FAILED');
    expect(rejection?.validation?.issues[0]?.code).toBe('INSTRUCTOR_HOURS_EXCEEDED');
  });

  it('reports a completed run without a timetable as a 200 with generated=false', async () => {
    installFetchMock([
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            departmentGenerationResult({
              generated: false,
              placements: [],
              message: '',
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

    const result = await departmentGenerationApi.preview({ semester: 8, department: 2, max_time_seconds: 30 });

    expect(result.generated).toBe(false);
    expect(result.solver?.status).toBe('INFEASIBLE');
    expect(result.placements).toEqual([]);
  });

  it('returns the placements of a solved preview unchanged', async () => {
    installFetchMock([
      {
        url: `${PROXY}/scheduling/generate`,
        method: 'POST',
        handler: () => jsonResponse(departmentGenerationResult()),
      },
    ]);

    const result = await departmentGenerationApi.preview({ semester: 8, department: 2 });

    expect(result.generated).toBe(true);
    expect(result.persisted).toBe(false);
    expect(result.placements).toHaveLength(1);
    expect(result.placements?.[0]?.slots).toHaveLength(2);
    expect(result.placements?.[0]?.penalty).toBe(placement().penalty);
  });
});
