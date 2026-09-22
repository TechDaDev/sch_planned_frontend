/**
 * Generation outcome classification.
 *
 * The backend answers a generation request in three materially different ways,
 * and the UI must not flatten them:
 *
 * - **HTTP 409** — generation was refused before or during problem building. The
 *   body carries a `reason` plus the structured issues that explain it
 *   (`PRE_SCHEDULING_VALIDATION_FAILED`, `CANDIDATE_BUILD_FAILED`, and for a
 *   draft request `GENERATION_RESULT_INCOMPLETE`).
 * - **HTTP 200 with `generated: false`** — the solver ran to completion and found
 *   no timetable. This is a valid result, not a malformed request.
 * - **HTTP 200 with `generated: true`** — a timetable was produced.
 *
 * Transport failures are separated too, so "permission denied" and "the request
 * was invalid" are never presented as "generation failed".
 */

import { ApiClientError } from '@/lib/api/errors';
import { asGenerationRejection } from '@/lib/scheduling/api';
import { describeRejectionReason, formatRejectionReason } from '@/lib/scheduling/formatters';
import type {
  CollegeGenerationDiagnostics,
  GenerationDiagnostics,
  GenerationRejectionReason,
  PreSchedulingValidationResult,
  ValidationIssue,
} from '@/lib/scheduling/types';

export type GenerationOutcomeKind =
  | 'solved'
  | 'no-timetable'
  | 'not-ready'
  | 'no-candidates'
  | 'incomplete'
  | 'invalid-request'
  | 'permission-denied'
  | 'not-found'
  | 'server-error'
  | 'cancelled';

export interface GenerationFailure {
  kind: GenerationOutcomeKind;
  /** Short headline for the failure. */
  title: string;
  /** One sentence stating what happened, in the backend's own terms. */
  description: string;
  reason: GenerationRejectionReason | null;
  validation: PreSchedulingValidationResult | null;
  generationIssues: ValidationIssue[];
  /** Present for a rejected request body; the backend's field messages. */
  fieldErrors?: Record<string, string[]>;
  /** Raw normalized message, shown as a secondary line. */
  detail?: string;
}

/** True when a completed response actually carries placements. */
export function hasGeneratedTimetable(result: { generated: boolean }): boolean {
  return result.generated === true;
}

function failureForReason(
  reason: GenerationRejectionReason,
  options: {
    message?: string;
    validation?: PreSchedulingValidationResult | null;
    generationIssues?: ValidationIssue[];
  },
): GenerationFailure {
  const kind: GenerationOutcomeKind =
    reason === 'PRE_SCHEDULING_VALIDATION_FAILED'
      ? 'not-ready'
      : reason === 'CANDIDATE_BUILD_FAILED'
        ? 'no-candidates'
        : 'incomplete';

  const description =
    options.message && options.message.trim().length > 0
      ? options.message
      : describeRejectionReason(reason);

  return {
    kind,
    title: formatRejectionReason(reason),
    description,
    reason,
    validation: options.validation ?? null,
    generationIssues: options.generationIssues ?? [],
  };
}

/**
 * Build the failure view of a structured 409 body.
 *
 * The body is read through `hasGenerationRejectionReason` before it is treated as
 * a rejection, so an unexpected payload cannot be rendered as if it were one.
 */
export function failureFromRejection(value: {
  reason: GenerationRejectionReason;
  message?: string;
  validation?: PreSchedulingValidationResult | null;
  generation_issues?: ValidationIssue[];
}): GenerationFailure {
  return failureForReason(value.reason, {
    message: value.message,
    validation: value.validation ?? null,
    generationIssues: value.generation_issues ?? [],
  });
}

/** Build the failure view of a thrown transport error. */
export function failureFromError(error: unknown): GenerationFailure {
  if (error instanceof ApiClientError) {
    const base = {
      reason: null,
      validation: null,
      generationIssues: [] as ValidationIssue[],
      detail: error.detail,
    };

    if (error.status === 0) {
      return {
        ...base,
        kind: 'cancelled',
        title: 'Request not completed',
        description: error.detail,
      };
    }
    if (error.status === 400) {
      return {
        ...base,
        kind: 'invalid-request',
        title: 'Request invalid',
        description: 'The request was rejected as invalid.',
        fieldErrors: error.fieldErrors,
      };
    }
    if (error.status === 401) {
      return {
        ...base,
        kind: 'permission-denied',
        title: 'Session expired',
        description: 'Sign in again to continue.',
      };
    }
    if (error.status === 403) {
      return {
        ...base,
        kind: 'permission-denied',
        title: 'Permission denied',
        description: 'Your role does not allow this scheduling action.',
      };
    }
    if (error.status === 404) {
      return {
        ...base,
        kind: 'not-found',
        title: 'Not found',
        description: 'The requested record is not available to your account.',
      };
    }
    if (error.status === 409) {
      return {
        ...base,
        kind: 'incomplete',
        title: 'Generation refused',
        description: error.detail,
      };
    }
    return {
      ...base,
      kind: 'server-error',
      title: 'Generation could not be completed',
      description: error.detail,
    };
  }

  return {
    kind: 'server-error',
    title: 'Generation could not be completed',
    description: 'The request failed before the backend answered.',
    reason: null,
    validation: null,
    generationIssues: [],
  };
}

/**
 * Failure view of a 200 response whose solver produced no timetable.
 *
 * The run itself succeeded, so the wording says so: an infeasible solve is not a
 * server error and not a malformed request.
 */
export function failureFromNoTimetable(
  solverStatus: string | null | undefined,
  diagnostics?: { sessions_without_candidates?: string[] } | null,
): GenerationFailure {
  const withoutCandidates = diagnostics?.sessions_without_candidates ?? [];
  const description =
    solverStatus === 'INFEASIBLE'
      ? 'The solver ran to completion and proved that no timetable exists for the current data.'
      : 'The solver ran to completion without producing a timetable.';

  return {
    kind: 'no-timetable',
    title: 'No timetable produced',
    description,
    reason: null,
    validation: null,
    generationIssues: withoutCandidates.map((sessionId) => ({
      code: 'NO_PLACEMENT_CANDIDATES',
      severity: 'ERROR' as const,
      message: `Session ${sessionId} has no placement candidate.`,
      entity_type: 'Session',
      entity_id: null,
      details: { session_id: sessionId },
    })),
  };
}

/** A failure together with the diagnostics the backend sent alongside it. */
export interface ClassifiedGenerationError {
  failure: GenerationFailure;
  diagnostics: GenerationDiagnostics | CollegeGenerationDiagnostics | null;
}

/**
 * Classify a thrown generation error.
 *
 * A structured 409 body is preferred over the normalized message, because its
 * reason and issues are what the operator needs. Anything else is classified by
 * status so "invalid request", "permission denied" and "server error" stay
 * distinguishable.
 */
export function classifyGenerationError(cause: unknown): ClassifiedGenerationError {
  if (cause instanceof ApiClientError && cause.status === 409) {
    const rejection = asGenerationRejection(cause.payload);
    if (rejection) {
      return {
        failure: failureFromRejection(rejection),
        diagnostics: rejection.diagnostics ?? null,
      };
    }
  }
  return { failure: failureFromError(cause), diagnostics: null };
}
