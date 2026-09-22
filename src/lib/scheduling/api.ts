/**
 * Scheduling API layer.
 *
 * Every call goes through the F0 browser client, which targets the same-origin
 * BFF (`/api/backend/...`). Nothing in this module knows about the backend host,
 * the cookies or the Authorization header.
 *
 * The surface is deliberate:
 * - two generation *actions* that never persist anything;
 * - two draft actions that run generation server-side and store its result;
 * - a read-only schedule/version/entry surface with no update or delete helper,
 *   because these resources are immutable history.
 *
 * Request bodies carry only what the backend documents. No solver control other
 * than `max_time_seconds` is ever sent: the seed, the worker count and the solver
 * log are fixed server-side.
 */

import { apiFetch, apiFetchBinary } from '@/lib/api/client';
import { getRecord, listCollection } from '@/lib/api/resource';
import type {
  AuditEvent,
  AuditFilters,
  CollegeDraftRequest,
  CollegeDraftResult,
  CollegeGenerationRequest,
  CollegeGenerationResult,
  DepartmentDraftRequest,
  DepartmentDraftResult,
  DepartmentGenerationRequest,
  DepartmentGenerationResult,
  DraftRejectedResult,
  EntryFilters,
  GenerationRejectedResult,
  ManualEditApplyResult,
  ManualEditRequest,
  ManualEditValidationResult,
  PreSchedulingValidationResult,
  PublishedScheduleResult,
  ScheduleAnalyticsResult,
  ScheduleDetail,
  ScheduleEntry,
  ScheduleFilters,
  ScheduleSummary,
  ScheduleVersionDetail,
  ScheduleVersionSummary,
  SemesterPlanApplyResult,
  SemesterPlanValidationResult,
  ValidationRequest,
  WorkflowAction,
  WorkflowTransitionResult,
  WorkflowValidationResult,
} from '@/lib/scheduling/types';

/**
 * Backend endpoint paths, relative to the `/api/` prefix.
 *
 * The documented Django routes end with a trailing slash. It is not repeated
 * here because the browser client normalizes a proxy path into segments, and the
 * BFF proxy re-adds the slash Django requires when it builds the upstream URL
 * (see `buildBackendUrl`). Writing it in both places would only invite them to
 * disagree.
 */
export const SCHEDULING_ENDPOINTS = {
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
} as const;

// --- Readiness (Phase 7) --------------------------------------------------

export const validationApi = {
  /**
   * Run the deterministic readiness check.
   *
   * A `COLLEGE` body must omit `department`; a `DEPARTMENT` body must supply it.
   * The endpoint writes nothing.
   */
  run: (payload: ValidationRequest, signal?: AbortSignal) =>
    apiFetch<PreSchedulingValidationResult>(SCHEDULING_ENDPOINTS.validate, {
      method: 'POST',
      json: payload,
      signal,
    }),
};

// --- Preview generation (Phases 9 and 10) --------------------------------

export const departmentGenerationApi = {
  /** Preview only: `persisted` is always false and nothing is stored. */
  preview: (payload: DepartmentGenerationRequest, signal?: AbortSignal) =>
    apiFetch<DepartmentGenerationResult>(SCHEDULING_ENDPOINTS.generateDepartment, {
      method: 'POST',
      json: payload,
      signal,
    }),
};

export const collegeGenerationApi = {
  /**
   * Whole-semester preview. The body never carries `department` or `scope`, and
   * the endpoint rejects any field it does not define.
   */
  preview: (payload: CollegeGenerationRequest, signal?: AbortSignal) =>
    apiFetch<CollegeGenerationResult>(SCHEDULING_ENDPOINTS.generateCollege, {
      method: 'POST',
      json: payload,
      signal,
    }),
};

/** The two preview endpoints, discriminated by what they accept. */
export const PREVIEW_ENDPOINTS = {
  department: SCHEDULING_ENDPOINTS.generateDepartment,
  college: SCHEDULING_ENDPOINTS.generateCollege,
} as const;

// --- Draft generation and persistence (Phase 11) -------------------------

/**
 * Generate and persist a department draft.
 *
 * The server runs the generation pipeline itself; the client never supplies
 * placements, a status or a version number.
 */
export function createDepartmentDraft(
  payload: DepartmentDraftRequest,
  signal?: AbortSignal,
): Promise<DepartmentDraftResult> {
  return apiFetch<DepartmentDraftResult>(
    SCHEDULING_ENDPOINTS.generateDepartmentDraft,
    { method: 'POST', json: payload, signal },
  );
}

/** Generate and persist a college-wide draft. College administrators only. */
export function createCollegeDraft(
  payload: CollegeDraftRequest,
  signal?: AbortSignal,
): Promise<CollegeDraftResult> {
  return apiFetch<CollegeDraftResult>(SCHEDULING_ENDPOINTS.generateCollegeDraft, {
    method: 'POST',
    json: payload,
    signal,
  });
}

export const departmentDraftApi = { create: createDepartmentDraft };
export const collegeDraftApi = { create: createCollegeDraft };

// --- Persisted schedules and versions (read-only) ------------------------

export const schedulesApi = {
  /** Documented exact filters: `semester`, `scope`, `department`. */
  list: (filters: ScheduleFilters = {}, signal?: AbortSignal) =>
    listCollection<ScheduleSummary>(SCHEDULING_ENDPOINTS.schedules, {
      query: filters,
      signal,
    }),
  get: (id: number, signal?: AbortSignal) =>
    getRecord<ScheduleDetail>(SCHEDULING_ENDPOINTS.schedules, id, signal),
  /** Newest version first, as the backend orders it. */
  versions: (id: number, signal?: AbortSignal) =>
    listCollection<ScheduleVersionSummary>(
      `${SCHEDULING_ENDPOINTS.schedules}/${id}/versions`,
      { signal },
    ),
};

export const scheduleVersionsApi = {
  get: (id: number, signal?: AbortSignal) =>
    getRecord<ScheduleVersionDetail>(SCHEDULING_ENDPOINTS.scheduleVersions, id, signal),
  /**
   * Entries of one version, rendered from that version's own snapshots.
   *
   * The documented filters narrow the authorized queryset and can never widen it;
   * local filtering is used on top of them for presentation-only concerns.
   */
  entries: (id: number, filters: EntryFilters = {}, signal?: AbortSignal) =>
    listCollection<ScheduleEntry>(
      `${SCHEDULING_ENDPOINTS.scheduleVersions}/${id}/entries`,
      { query: filters, signal },
    ),
};

// --- Validated manual editing (F4) ---------------------------------------

export const versionPath = (id: number, action: string): string =>
  `${SCHEDULING_ENDPOINTS.scheduleVersions}/${id}/${action}`;

export const manualEditApi = {
  /**
   * Validate a proposal without storing it.
   *
   * An invalid but well-formed proposal answers `200` with `valid: false`; that is a
   * normal result, not a transport error, so the caller inspects the body.
   */
  validate: (versionId: number, payload: ManualEditRequest, signal?: AbortSignal) =>
    apiFetch<ManualEditValidationResult>(versionPath(versionId, 'validate-manual-edit'), {
      method: 'POST',
      json: payload,
      signal,
    }),
  /**
   * Apply a validated proposal, which stores a new immutable `MANUAL_EDIT` version.
   *
   * The backend revalidates the whole proposal under a lock, so a stale base answers
   * `409` instead of branching history.
   */
  apply: (versionId: number, payload: ManualEditRequest, signal?: AbortSignal) =>
    apiFetch<ManualEditApplyResult>(versionPath(versionId, 'manual-edit'), {
      method: 'POST',
      json: payload,
      signal,
    }),
};

// --- Workflow and publication (F4) ---------------------------------------

export const workflowApi = {
  /** Report whether a stored version can still advance. Writes nothing. */
  validation: (versionId: number, signal?: AbortSignal) =>
    apiFetch<WorkflowValidationResult>(versionPath(versionId, 'workflow-validation'), {
      signal,
    }),
  /**
   * Run one workflow action.
   *
   * The body is empty on purpose: the stage comes from the URL, the actor from the
   * session and the timestamp from the server. No status, actor, timestamp or
   * published-version pointer is ever sent.
   */
  action: (versionId: number, action: WorkflowAction, signal?: AbortSignal) =>
    apiFetch<WorkflowTransitionResult>(versionPath(versionId, action.toLowerCase()), {
      method: 'POST',
      json: {},
      signal,
    }),
};

// --- Official timetable (F4) ---------------------------------------------

export const publishedScheduleApi = {
  /**
   * The official published timetable of a semester.
   *
   * `semester` is required; the authoritative version comes from the schedule's
   * published-version pointer, never from a `status=PUBLISHED` query. A semester with
   * no publication answers `404`, which the UI renders as an empty state rather than
   * falling back to a draft.
   */
  current: (semesterId: number, signal?: AbortSignal) =>
    apiFetch<PublishedScheduleResult>(SCHEDULING_ENDPOINTS.publishedCurrent, {
      query: { semester: semesterId },
      signal,
    }),
};

// --- Reports and analytics (F4) ------------------------------------------

export const analyticsApi = {
  /** Analytics of one exact persisted version; works for every status. */
  forVersion: (versionId: number, signal?: AbortSignal) =>
    apiFetch<ScheduleAnalyticsResult>(versionPath(versionId, 'analytics'), { signal }),
  /** Analytics of the current publication, narrowed for the caller's scope. */
  forPublished: (semesterId: number, signal?: AbortSignal) =>
    apiFetch<ScheduleAnalyticsResult>(SCHEDULING_ENDPOINTS.publishedAnalytics, {
      query: { semester: semesterId },
      signal,
    }),
};

// --- Exports (F4) --------------------------------------------------------

/**
 * Binary downloads.
 *
 * The backend produces the workbook or the PDF, so the response is streamed through
 * the F0 proxy as bytes with `Content-Type` and `Content-Disposition` preserved.
 * Nothing is rebuilt in JavaScript and no token is attached by the browser.
 */
export const versionExportApi = {
  xlsx: (versionId: number, signal?: AbortSignal) =>
    apiFetchBinary(versionPath(versionId, 'export/xlsx'), { signal }),
  pdf: (versionId: number, signal?: AbortSignal) =>
    apiFetchBinary(versionPath(versionId, 'export/pdf'), { signal }),
};

export const publishedExportApi = {
  xlsx: (semesterId: number, signal?: AbortSignal) =>
    apiFetchBinary(SCHEDULING_ENDPOINTS.publishedExportXlsx, {
      query: { semester: semesterId },
      signal,
    }),
  pdf: (semesterId: number, signal?: AbortSignal) =>
    apiFetchBinary(SCHEDULING_ENDPOINTS.publishedExportPdf, {
      query: { semester: semesterId },
      signal,
    }),
};

// --- Semester teaching plan import (F4) ----------------------------------

/**
 * The two multipart endpoints.
 *
 * The workbook is posted as `multipart/form-data`, which the F0 proxy streams; it is
 * never converted to base64 JSON. Apply re-validates from scratch, so no validation
 * token is sent because none exists.
 */
export const semesterPlanImportApi = {
  template: (signal?: AbortSignal) =>
    apiFetchBinary(SCHEDULING_ENDPOINTS.semesterPlanTemplate, { signal }),
  validate: (form: FormData, signal?: AbortSignal) =>
    apiFetch<SemesterPlanValidationResult>(SCHEDULING_ENDPOINTS.semesterPlanValidate, {
      method: 'POST',
      body: form,
      signal,
    }),
  apply: (form: FormData, signal?: AbortSignal) =>
    apiFetch<SemesterPlanApplyResult>(SCHEDULING_ENDPOINTS.semesterPlanApply, {
      method: 'POST',
      body: form,
      signal,
    }),
};

// --- Audit trail (F4) ----------------------------------------------------

/** Read-only: no create, update or delete helper exists for an audit event. */
export const auditApi = {
  /** Documented exact filters only; they narrow the authorized scope. */
  list: (filters: AuditFilters = {}, signal?: AbortSignal) =>
    listCollection<AuditEvent>(SCHEDULING_ENDPOINTS.auditEvents, {
      query: filters,
      signal,
    }),
  get: (id: string, signal?: AbortSignal) =>
    apiFetch<AuditEvent>(`${SCHEDULING_ENDPOINTS.auditEvents}/${encodeURIComponent(id)}`, {
      signal,
    }),
};

// --- Error payload typing -------------------------------------------------

/**
 * True when a value carries the structured refusal body of a generation or draft
 * request (HTTP 409).
 *
 * The reason discriminates the failure classes the UI must tell apart, so it is
 * checked before the body is read as a rejection result.
 */
export function hasGenerationRejectionReason(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { reason?: unknown }).reason === 'string'
  );
}

/** Read a 409 body as an unstructured rejection result. */
export function asGenerationRejection(
  value: unknown,
): GenerationRejectedResult | DraftRejectedResult | null {
  return hasGenerationRejectionReason(value)
    ? (value as GenerationRejectedResult | DraftRejectedResult)
    : null;
}
