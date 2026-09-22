import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@/lib/api/errors';
import {
  classifyGenerationError,
  failureFromError,
  failureFromNoTimetable,
  failureFromRejection,
  hasGeneratedTimetable,
} from '@/lib/scheduling/outcome';
import { generationRejection, validationResult } from '@/test/scheduling-fixtures';

describe('completed results', () => {
  it('treats generated=true as a timetable', () => {
    expect(hasGeneratedTimetable({ generated: true })).toBe(true);
  });

  it('treats generated=false as a completed run without a timetable', () => {
    expect(hasGeneratedTimetable({ generated: false })).toBe(false);
  });
});

describe('structured refusals', () => {
  it('classifies a readiness refusal as configuration not ready', () => {
    const failure = failureFromRejection(generationRejection());

    expect(failure.kind).toBe('not-ready');
    expect(failure.title).toBe('Configuration not ready');
    expect(failure.reason).toBe('PRE_SCHEDULING_VALIDATION_FAILED');
    expect(failure.validation?.issues).toHaveLength(1);
  });

  it('classifies a candidate build refusal as no placement candidates', () => {
    const failure = failureFromRejection(
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
    );

    expect(failure.kind).toBe('no-candidates');
    expect(failure.title).toBe('No placement candidates');
    expect(failure.generationIssues.map((issue) => issue.code)).toEqual([
      'NO_PLACEMENT_CANDIDATES',
    ]);
  });

  it('classifies an incomplete persistence result as incomplete', () => {
    const failure = failureFromRejection(
      generationRejection({ reason: 'GENERATION_RESULT_INCOMPLETE' }),
    );

    expect(failure.kind).toBe('incomplete');
    expect(failure.title).toBe('Generation result incomplete');
  });

  it('prefers the backend message over the canned description', () => {
    const failure = failureFromRejection(
      generationRejection({ message: 'Three components are missing a room requirement.' }),
    );

    expect(failure.description).toBe('Three components are missing a room requirement.');
  });

  it('falls back to the documented description when the message is empty', () => {
    const failure = failureFromRejection(generationRejection({ message: '' }));

    expect(failure.description).toContain('Readiness validation reported blocking errors');
  });
});

describe('completed runs without a timetable', () => {
  it('states that an infeasible solve proved no timetable exists', () => {
    const failure = failureFromNoTimetable('INFEASIBLE', null);

    expect(failure.kind).toBe('no-timetable');
    expect(failure.title).toBe('No timetable produced');
    expect(failure.description).toContain('proved that no timetable exists');
  });

  it('does not call an incomplete solve a server error', () => {
    const failure = failureFromNoTimetable('UNKNOWN', null);

    expect(failure.kind).toBe('no-timetable');
    expect(failure.description).toContain('ran to completion');
  });

  it('surfaces sessions that had no candidate as generation issues', () => {
    const failure = failureFromNoTimetable('INFEASIBLE', {
      sessions_without_candidates: ['tc-10#s1', 'tc-11#s2'],
    });

    expect(failure.generationIssues).toHaveLength(2);
    expect(failure.generationIssues[0]?.details?.['session_id']).toBe('tc-10#s1');
  });
});

describe('transport failures', () => {
  const clientError = (status: number, detail = 'Rejected.', payload?: unknown) =>
    new ApiClientError({ status, detail }, payload);

  it('separates an invalid request from a permission denial', () => {
    expect(failureFromError(clientError(400)).kind).toBe('invalid-request');
    expect(failureFromError(clientError(403)).kind).toBe('permission-denied');
  });

  it('keeps field errors of an invalid request', () => {
    const failure = failureFromError(
      new ApiClientError({
        status: 400,
        detail: 'Invalid.',
        fieldErrors: { max_time_seconds: ['Ensure this value is less than or equal to 120.'] },
      }),
    );

    expect(failure.fieldErrors?.['max_time_seconds']?.[0]).toContain('less than or equal');
  });

  it('reports a foreign record as not found rather than forbidden', () => {
    expect(failureFromError(clientError(404)).kind).toBe('not-found');
  });

  it('never claims the solver ran when the request failed', () => {
    const failure = failureFromError(clientError(500));

    expect(failure.kind).toBe('server-error');
    expect(failure.description).not.toContain('solver');
  });

  it('classifies an unknown thrown value as a server error', () => {
    expect(failureFromError(new Error('boom')).kind).toBe('server-error');
    expect(failureFromError(null).kind).toBe('server-error');
  });
});

describe('classifying a thrown generation error', () => {
  it('uses the structured 409 body when one is present', () => {
    const error = new ApiClientError(
      { status: 409, detail: 'Conflict.' },
      generationRejection(),
    );

    const { failure, diagnostics } = classifyGenerationError(error);

    expect(failure.kind).toBe('not-ready');
    expect(failure.validation?.issues[0]?.code).toBe('INSTRUCTOR_HOURS_EXCEEDED');
    expect(diagnostics).toBeNull();
  });

  it('falls back to the status when the 409 body is not a rejection', () => {
    const error = new ApiClientError({ status: 409, detail: 'Conflict happened.' }, null);

    const { failure } = classifyGenerationError(error);

    expect(failure.kind).toBe('incomplete');
    expect(failure.description).toBe('Conflict happened.');
  });

  it('keeps diagnostics sent with a refusal', () => {
    const error = new ApiClientError(
      { status: 409, detail: 'Conflict.' },
      {
        ...generationRejection({ reason: 'CANDIDATE_BUILD_FAILED' }),
        diagnostics: {
          components: 6,
          sessions: 12,
          candidates: 0,
          min_candidates_per_session: 0,
          max_candidates_per_session: 0,
          sessions_with_fewest_candidates: [],
          sessions_without_candidates: ['tc-10#s1'],
        },
      },
    );

    const { failure, diagnostics } = classifyGenerationError(error);

    expect(failure.kind).toBe('no-candidates');
    expect(diagnostics?.sessions_without_candidates).toEqual(['tc-10#s1']);
  });

  it('classifies a validation payload carrying warnings as ready', () => {
    const failure = failureFromRejection(
      generationRejection({
        validation: validationResult({
          ready: true,
          summary: { components_checked: 4, errors: 0, warnings: 3 },
          issues: [
            {
              code: 'ROOM_CAPACITY_UNKNOWN',
              severity: 'WARNING',
              message: 'A room has no capacity recorded.',
              entity_type: 'Room',
              entity_id: 22,
            },
          ],
        }),
      }),
    );

    expect(failure.validation?.ready).toBe(true);
    expect(failure.validation?.issues[0]?.severity).toBe('WARNING');
  });
});
