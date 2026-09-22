import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@/lib/api/errors';
import { EXPORT_MEDIA_TYPES } from '@/lib/scheduling/exports';
import {
  SCHEDULING_ENDPOINTS,
  analyticsApi,
  asGenerationRejection,
  auditApi,
  collegeDraftApi,
  collegeGenerationApi,
  departmentDraftApi,
  departmentGenerationApi,
  hasGenerationRejectionReason,
  manualEditApi,
  publishedExportApi,
  publishedScheduleApi,
  scheduleVersionsApi,
  schedulesApi,
  semesterPlanImportApi,
  validationApi,
  versionExportApi,
  workflowApi,
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
import {
  analyticsResult,
  auditEvent,
  importApplyResult,
  importIssue,
  importValidationResult,
  manualEditApplyResult,
  manualEditValidation,
  publishedSchedule,
  workflowTransitionResult,
  workflowValidationResult,
} from '@/test/f4-fixtures';
import { binaryResponse, installFetchMock, jsonResponse } from '@/test/fetch-mock';

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
      publishedCurrent: 'published-schedules/current',
      publishedAnalytics: 'published-schedules/current/analytics',
      publishedExportXlsx: 'published-schedules/current/export/xlsx',
      publishedExportPdf: 'published-schedules/current/export/pdf',
      semesterPlanTemplate: 'imports/semester-plan/template',
      semesterPlanValidate: 'imports/semester-plan/validate',
      semesterPlanApply: 'imports/semester-plan/apply',
      auditEvents: 'audit-events',
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
      'published-schedules/current/',
      'published-schedules/current/analytics/',
      'published-schedules/current/export/xlsx/',
      'published-schedules/current/export/pdf/',
      'imports/semester-plan/template/',
      'imports/semester-plan/validate/',
      'imports/semester-plan/apply/',
      'audit-events/',
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

// --- F4: manual editing, workflow, publication, reports, import and audit ---

describe('manual-edit endpoints', () => {
  it('posts a proposal to the validate action of one version', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/validate-manual-edit`,
        method: 'POST',
        handler: () => jsonResponse(manualEditValidation()),
      },
    ]);

    const result = await manualEditApi.validate(501, {
      notes: 'Move it.',
      changes: [{ entry_id: 900, time_slot_ids: [33, 34], room_id: 24 }],
    });

    expect(result.valid).toBe(true);
    expect(mock.calls[0]?.method).toBe('POST');
    expect(bodyOf(mock.calls[0]!.init)).toEqual({
      notes: 'Move it.',
      changes: [{ entry_id: 900, time_slot_ids: [33, 34], room_id: 24 }],
    });
  });

  it('accepts an invalid but well-formed proposal as a normal 200 answer', async () => {
    installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/validate-manual-edit`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            manualEditValidation({
              valid: false,
              summary: { changes: 1, errors: 1 },
              issues: [
                {
                  code: 'ROOM_DOUBLE_BOOKED',
                  message: 'The room is already used at that time.',
                  entry_id: 900,
                  conflicting_entry_id: 902,
                },
              ],
            }),
          ),
      },
    ]);

    const result = await manualEditApi.validate(501, { changes: [{ entry_id: 900, room_id: 24 }] });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.conflicting_entry_id).toBe(902);
  });

  it('posts to the apply action and returns the stored new version', async () => {
    installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/manual-edit`,
        method: 'POST',
        handler: () => jsonResponse(manualEditApplyResult()),
      },
    ]);

    const result = await manualEditApi.apply(501, { changes: [{ entry_id: 900, room_id: 24 }] });

    expect(result.persisted).toBe(true);
    expect(result.version.source).toBe('MANUAL_EDIT');
    expect(result.base_version).toBe(501);
  });

  it('surfaces a 409 refusal with its structured body', async () => {
    installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/manual-edit`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              persisted: false,
              reason: 'STALE_BASE_VERSION',
              message: 'A newer version exists.',
            },
            409,
          ),
      },
    ]);

    await expect(
      manualEditApi.apply(501, { changes: [{ entry_id: 900, room_id: 24 }] }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('workflow endpoints', () => {
  it('reads the workflow validation of a version without writing', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/workflow-validation`,
        handler: () => jsonResponse(workflowValidationResult()),
      },
    ]);

    const result = await workflowApi.validation(501);

    expect(result.valid).toBe(true);
    expect(mock.calls[0]?.method).toBe('GET');
  });

  it('posts each action to its own path with an empty body', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/submit`,
        method: 'POST',
        handler: () => jsonResponse(workflowTransitionResult()),
      },
      {
        url: `${PROXY}/schedule-versions/601/publish`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            workflowTransitionResult({ action: 'publish', status: 'PUBLISHED', from_status: 'APPROVED' }),
          ),
      },
    ]);

    await workflowApi.action(501, 'SUBMIT');
    await workflowApi.action(601, 'PUBLISH');

    expect(mock.callsTo(`${PROXY}/schedule-versions/501/submit`)).toHaveLength(1);
    expect(bodyOf(mock.calls[0]!.init)).toEqual({});
    // No status, actor, timestamp or pointer is ever sent.
    expect(Object.keys(bodyOf(mock.calls[0]!.init))).toEqual([]);
  });
});

describe('published timetable endpoint', () => {
  it('requests the current publication of one semester', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/published-schedules/current?semester=8`,
        handler: () => jsonResponse(publishedSchedule()),
      },
    ]);

    const result = await publishedScheduleApi.current(8);

    expect(mock.calls[0]?.url).toBe(`${PROXY}/published-schedules/current?semester=8`);
    expect(result.version.status).toBe('PUBLISHED');
    expect(result.entries).toHaveLength(1);
  });

  it('never asks for a status filter instead of the pointer', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/published-schedules/current?semester=8`,
        handler: () => jsonResponse(publishedSchedule()),
      },
    ]);

    await publishedScheduleApi.current(8);

    expect(mock.calls[0]?.url).not.toContain('status=');
  });

  it('reports a semester with no publication as a 404', async () => {
    installFetchMock([
      {
        url: `${PROXY}/published-schedules/current?semester=9`,
        handler: () => jsonResponse({ detail: 'Not found.' }, 404),
      },
    ]);

    await expect(publishedScheduleApi.current(9)).rejects.toMatchObject({ status: 404 });
  });
});

describe('analytics endpoints', () => {
  it('reads the analytics of one exact version', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/analytics`,
        handler: () => jsonResponse(analyticsResult()),
      },
    ]);

    const result = await analyticsApi.forVersion(501);

    expect(mock.calls[0]?.url).toBe(`${PROXY}/schedule-versions/501/analytics`);
    expect(result.summary.entry_count).toBe(12);
  });

  it('reads the analytics of the current publication of a semester', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/published-schedules/current/analytics?semester=8`,
        handler: () => jsonResponse(analyticsResult({ scope: 'COLLEGE' })),
      },
    ]);

    const result = await analyticsApi.forPublished(8);

    expect(mock.calls[0]?.url).toBe(`${PROXY}/published-schedules/current/analytics?semester=8`);
    expect(result.scope).toBe('COLLEGE');
  });
});

describe('binary export endpoints', () => {
  it('downloads a version workbook with its bytes and headers preserved', async () => {
    const bytes = new Uint8Array([80, 75, 3, 4]);
    installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/export/xlsx`,
        handler: () =>
          binaryResponse(bytes, EXPORT_MEDIA_TYPES.xlsx, {
            'content-disposition': 'attachment; filename="version-501.xlsx"',
          }),
      },
    ]);

    const download = await versionExportApi.xlsx(501);

    expect(download.contentType).toBe(EXPORT_MEDIA_TYPES.xlsx);
    expect(download.filename).toBe('version-501.xlsx');
    expect(new Uint8Array(await download.blob.arrayBuffer())).toEqual(bytes);
  });

  it('downloads a version PDF and a published workbook from their own paths', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/export/pdf`,
        handler: () => binaryResponse(new Uint8Array([37, 80, 68, 70]), EXPORT_MEDIA_TYPES.pdf),
      },
      {
        url: `${PROXY}/published-schedules/current/export/xlsx?semester=8`,
        handler: () => binaryResponse(new Uint8Array([1, 2]), EXPORT_MEDIA_TYPES.xlsx),
      },
    ]);

    const pdf = await versionExportApi.pdf(501);
    const published = await publishedExportApi.xlsx(8);

    expect(pdf.contentType).toBe(EXPORT_MEDIA_TYPES.pdf);
    expect(published.status).toBe(200);
    expect(mock.callsTo(`${PROXY}/published-schedules/current/export/xlsx?semester=8`)).toHaveLength(
      1,
    );
  });

  it('carries no token header of its own', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/export/xlsx`,
        handler: () => binaryResponse(new Uint8Array([1]), EXPORT_MEDIA_TYPES.xlsx),
      },
    ]);

    await versionExportApi.xlsx(501);

    const headers = (mock.calls[0]?.init.headers ?? {}) as Record<string, string>;
    expect(Object.keys(headers).map((key) => key.toLowerCase())).not.toContain('authorization');
  });

  it('reports a refused download as an ApiClientError', async () => {
    installFetchMock([
      {
        url: `${PROXY}/schedule-versions/501/export/pdf`,
        handler: () => jsonResponse({ detail: 'PDF rendering unavailable.' }, 503),
      },
    ]);

    await expect(versionExportApi.pdf(501)).rejects.toBeInstanceOf(ApiClientError);
  });
});

describe('semester plan import endpoints', () => {
  it('downloads the template as bytes', async () => {
    installFetchMock([
      {
        url: `${PROXY}/imports/semester-plan/template`,
        handler: () => binaryResponse(new Uint8Array([80, 75]), EXPORT_MEDIA_TYPES.xlsx),
      },
    ]);

    const download = await semesterPlanImportApi.template();

    expect(download.contentType).toBe(EXPORT_MEDIA_TYPES.xlsx);
  });

  it('posts a workbook as multipart form data, never as base64 JSON', async () => {
    const form = new FormData();
    form.append('department', '2');
    form.append('semester', '8');
    form.append('file', new File(['x'], 'plan.xlsx'));

    const mock = installFetchMock([
      {
        url: `${PROXY}/imports/semester-plan/validate`,
        method: 'POST',
        handler: () => jsonResponse(importValidationResult({ valid: true, issues: [] })),
      },
    ]);

    await semesterPlanImportApi.validate(form);

    const init = mock.calls[0]!.init;
    expect(init.body).toBe(form);
    expect(init.body).toBeInstanceOf(FormData);
    expect(typeof init.body).not.toBe('string');
  });

  it('posts the same multipart body when applying', async () => {
    const form = new FormData();
    form.append('department', '2');
    form.append('semester', '8');
    form.append('file', new File(['x'], 'plan.xlsx'));

    const mock = installFetchMock([
      {
        url: `${PROXY}/imports/semester-plan/apply`,
        method: 'POST',
        handler: () => jsonResponse(importApplyResult()),
      },
    ]);

    const result = await semesterPlanImportApi.apply(form);

    expect(result.created.courses).toBe(3);
    expect(mock.calls[0]!.init.body).toBe(form);
    // No validation token exists, so none is sent.
    expect(Object.keys(bodyOf({ body: '{}' }))).toEqual([]);
    expect(mock.calls[0]!.init.body).not.toHaveProperty('token');
  });

  it('surfaces a structured 400 refusal with its issues', async () => {
    installFetchMock([
      {
        url: `${PROXY}/imports/semester-plan/apply`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            { applied: false, created: null, warnings: [], issues: [importIssue()], detail: 'Invalid workbook.' },
            400,
          ),
      },
    ]);

    const error = await semesterPlanImportApi
      .apply(new FormData())
      .then(() => null)
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).status).toBe(400);
    expect((error as ApiClientError).payload).toMatchObject({ applied: false });
  });
});

describe('audit endpoints', () => {
  it('reads the newest events without a filter', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/audit-events`,
        handler: () => jsonResponse([auditEvent()]),
      },
    ]);

    const events = await auditApi.list();

    expect(events).toHaveLength(1);
    expect(mock.calls[0]?.url).toBe(`${PROXY}/audit-events`);
  });

  it('sends only the documented filters', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/audit-events?action=SCHEDULE_PUBLISHED&semester=8&department=2&created_after=2026-09-01T00%3A00%3A00&created_before=2026-09-30T23%3A59%3A59`,
        handler: () => jsonResponse([]),
      },
    ]);

    const events = await auditApi.list({
      action: 'SCHEDULE_PUBLISHED',
      semester: 8,
      department: 2,
      created_after: '2026-09-01T00:00:00',
      created_before: '2026-09-30T23:59:59',
    });

    expect(events).toEqual([]);
    expect(mock.calls).toHaveLength(1);
  });

  it('reads one event by its opaque id', async () => {
    const id = '0f5b2c1e-7a4d-4f6e-9c8b-1d2e3f4a5b6c';
    const mock = installFetchMock([
      { url: `${PROXY}/audit-events/${id}`, handler: () => jsonResponse(auditEvent()) },
    ]);

    const event = await auditApi.get(id);

    expect(event.id).toBe(id);
    expect(mock.calls[0]?.url).toBe(`${PROXY}/audit-events/${id}`);
  });

  it('reports an event outside the caller scope as 404, revealing nothing', async () => {
    installFetchMock([
      {
        url: `${PROXY}/audit-events/other-id`,
        handler: () => jsonResponse({ detail: 'Not found.' }, 404),
      },
    ]);

    await expect(auditApi.get('other-id')).rejects.toMatchObject({ status: 404 });
  });

  it('has no write helper for an audit event', () => {
    expect(Object.keys(auditApi).sort()).toEqual(['get', 'list']);
  });
});
