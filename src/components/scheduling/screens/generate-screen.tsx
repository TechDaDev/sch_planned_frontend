'use client';

import Link from 'next/link';
import * as React from 'react';

import { useAcademicUser } from '@/components/academic/use-academic-user';
import { GenerationFailureView, PreviewNotice } from '@/components/scheduling/outcome-panel';
import {
  DepartmentSummariesView,
  GenerationDiagnosticsView,
  GenerationSummaryView,
  SolverReportView,
} from '@/components/scheduling/generation-report';
import {
  DepartmentSelect,
  ScopeSelect,
  SemesterSelect,
  TimeLimitInput,
  semesterOptionLabel,
} from '@/components/scheduling/scope-controls';
import { TimetableView } from '@/components/scheduling/timetable-view';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';
import { departmentsApi, semestersApi } from '@/lib/academic/api';
import { ownDepartmentId } from '@/lib/academic/permissions';
import type { Department, Semester } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import {
  COLLEGE_TIME_LIMIT,
  DEPARTMENT_TIME_LIMIT,
  GENERATION_DURATION_NOTE,
  NEW_VERSION_MESSAGE,
  NOTES_MAX_LENGTH,
  PERSIST_DRAFT_MESSAGE,
  SCHEDULING_ROUTES,
} from '@/lib/scheduling/constants';
import { formatScope, formatSemester, formatValidationSemester } from '@/lib/scheduling/formatters';
import {
  collegeDraftApi,
  collegeGenerationApi,
  departmentDraftApi,
  departmentGenerationApi,
} from '@/lib/scheduling/api';
import { sessionsFromPlacements } from '@/lib/scheduling/normalization';
import {
  classifyGenerationError,
  failureFromNoTimetable,
  hasGeneratedTimetable,
  type GenerationFailure,
} from '@/lib/scheduling/outcome';
import {
  canChooseAnyDepartment,
  canGenerateCollegePreview,
  canGenerateDepartmentPreview,
  canPersistCollegeDraft,
  canPersistDepartmentDraft,
  isDepartmentlessScopedUser,
} from '@/lib/scheduling/permissions';
import type {
  CollegeDraftResult,
  CollegeGenerationDiagnostics,
  CollegeGenerationResult,
  DepartmentDraftResult,
  DepartmentGenerationResult,
  GenerationDiagnostics,
  ValidationScope,
} from '@/lib/scheduling/types';

/** Everything a completed run needs to be displayed, preview or persisted. */
type CompletedRun = {
  semester: DepartmentGenerationResult['semester'];
  scope: ValidationScope;
  departmentCode: string | null;
  solver: DepartmentGenerationResult['solver'];
  summary: DepartmentGenerationResult['summary'];
  placements: DepartmentGenerationResult['placements'];
  diagnostics: GenerationDiagnostics | CollegeGenerationDiagnostics | null;
  departmentSummaries?: CollegeGenerationResult['department_summaries'];
  solverStatus: string | null;
};

function toCompletedRun(
  result: DepartmentGenerationResult | CollegeGenerationResult,
  scope: ValidationScope,
): CompletedRun {
  const college = scope === 'COLLEGE';
  return {
    semester: result.semester,
    scope,
    departmentCode: college ? null : ((result as DepartmentGenerationResult).department?.code ?? null),
    solver: result.solver ?? null,
    summary: result.summary ?? null,
    placements: result.placements ?? [],
    diagnostics: result.diagnostics ?? null,
    departmentSummaries: college
      ? (result as CollegeGenerationResult).department_summaries
      : undefined,
    solverStatus: result.solver?.status ?? null,
  };
}

export function GenerateScreen() {
  const { user, capability } = useAcademicUser();

  const loadSemesters = React.useCallback((signal: AbortSignal) => semestersApi.list(signal), []);
  const loadDepartments = React.useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );
  const semesters = useCollection<Semester>(loadSemesters);
  const departments = useCollection<Department>(loadDepartments);

  const [semesterId, setSemesterId] = React.useState<number | null>(null);
  const [scope, setScope] = React.useState<ValidationScope>('DEPARTMENT');
  const [selectedDepartmentId, setSelectedDepartmentId] = React.useState<number | null>(null);
  const [departmentLimit, setDepartmentLimit] = React.useState<number>(
    DEPARTMENT_TIME_LIMIT.default,
  );
  const [collegeLimit, setCollegeLimit] = React.useState<number>(COLLEGE_TIME_LIMIT.default);
  const [notes, setNotes] = React.useState('');

  const [previewRun, setPreviewRun] = React.useState<CompletedRun | null>(null);
  const [previewFailure, setPreviewFailure] = React.useState<GenerationFailure | null>(null);
  const [previewDiagnostics, setPreviewDiagnostics] = React.useState<
    GenerationDiagnostics | CollegeGenerationDiagnostics | null
  >(null);
  const [isPreviewing, setIsPreviewing] = React.useState(false);

  const [draftRun, setDraftRun] = React.useState<CompletedRun | null>(null);
  const [draftOutcome, setDraftOutcome] = React.useState<
    DepartmentDraftResult | CollegeDraftResult | null
  >(null);
  const [draftFailure, setDraftFailure] = React.useState<GenerationFailure | null>(null);
  const [draftDiagnostics, setDraftDiagnostics] = React.useState<
    GenerationDiagnostics | CollegeGenerationDiagnostics | null
  >(null);
  const [isDrafting, setIsDrafting] = React.useState(false);

  const allowCollege = canGenerateCollegePreview(capability);
  const fixedDepartment = canChooseAnyDepartment(capability) ? null : (user?.department ?? null);
  const own = ownDepartmentId(capability);

  // A scoped role has exactly one department: it is derived, never selected, so
  // no foreign department can be chosen even transiently.
  const departmentId = fixedDepartment
    ? fixedDepartment.id
    : scope === 'COLLEGE'
      ? null
      : selectedDepartmentId;

  if (isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="Generation runs for your role are scoped to a department, and no department is attached to this account. Ask a college administrator to assign your department."
      />
    );
  }

  const targetDepartment = scope === 'COLLEGE' ? null : (departmentId ?? own);
  const canPreview =
    semesterId !== null &&
    !isPreviewing &&
    !isDrafting &&
    (scope === 'COLLEGE'
      ? canGenerateCollegePreview(capability)
      : canGenerateDepartmentPreview(capability, targetDepartment));
  const canDraft =
    semesterId !== null &&
    !isPreviewing &&
    !isDrafting &&
    notes.length <= NOTES_MAX_LENGTH &&
    (scope === 'COLLEGE'
      ? canPersistCollegeDraft(capability)
      : canPersistDepartmentDraft(capability, targetDepartment));

  const anyGenerationAllowed =
    canGenerateDepartmentPreview(capability, own) || canGenerateCollegePreview(capability);

  if (!anyGenerationAllowed) {
    return (
      <RestrictedState
        title="Timetable generation is not available for your role"
        description="Your account can read persisted schedule history, but generation and draft storage belong to the operational roles."
        detail={
          <Link href={SCHEDULING_ROUTES.schedules} className="underline">
            Open schedule history
          </Link>
        }
      />
    );
  }

  const runPreview = async () => {
    if (!canPreview || semesterId === null) {
      return;
    }
    setIsPreviewing(true);
    setPreviewFailure(null);
    setPreviewRun(null);
    setPreviewDiagnostics(null);
    try {
      // The preview endpoints persist nothing: no schedule or version is created.
      const result =
        scope === 'COLLEGE'
          ? await collegeGenerationApi.preview({
              semester: semesterId,
              max_time_seconds: collegeLimit,
            })
          : await departmentGenerationApi.preview({
              semester: semesterId,
              department: targetDepartment ?? 0,
              max_time_seconds: departmentLimit,
            });
      if (hasGeneratedTimetable(result)) {
        setPreviewRun(toCompletedRun(result, scope));
      } else {
        setPreviewDiagnostics(result.diagnostics ?? null);
        setPreviewFailure(
          failureFromNoTimetable(result.solver?.status, result.diagnostics ?? null),
        );
      }
    } catch (cause) {
      const { failure, diagnostics } = classifyGenerationError(cause);
      setPreviewDiagnostics(diagnostics);
      setPreviewFailure(failure);
    } finally {
      setIsPreviewing(false);
    }
  };

  const runDraft = async () => {
    if (!canDraft || semesterId === null) {
      return;
    }
    setIsDrafting(true);
    setDraftFailure(null);
    setDraftRun(null);
    setDraftOutcome(null);
    setDraftDiagnostics(null);
    try {
      // A draft request runs generation again on the server and stores *that*
      // result. The preview payload is never sent, and no placement is ever
      // supplied by the client.
      const result =
        scope === 'COLLEGE'
          ? await collegeDraftApi.create({
              semester: semesterId,
              max_time_seconds: collegeLimit,
              notes,
            })
          : await departmentDraftApi.create({
              semester: semesterId,
              department: targetDepartment ?? 0,
              max_time_seconds: departmentLimit,
              notes,
            });
      setDraftOutcome(result);
      if (result.persisted && hasGeneratedTimetable(result)) {
        setDraftRun(toCompletedRun(result, scope));
      } else if (!hasGeneratedTimetable(result)) {
        setDraftDiagnostics(result.diagnostics ?? null);
        setDraftFailure(
          failureFromNoTimetable(result.solver?.status, result.diagnostics ?? null),
        );
      }
    } catch (cause) {
      const { failure, diagnostics } = classifyGenerationError(cause);
      setDraftDiagnostics(diagnostics);
      setDraftFailure(failure);
    } finally {
      setIsDrafting(false);
    }
  };

  const showDepartmentChoices = scope === 'DEPARTMENT';
  const selectedSemester = semesters.items.find((semester) => semester.id === semesterId) ?? null;
  const runningScopeSummary = `${scope === 'COLLEGE' ? 'the whole college' : 'the department'}${
    selectedSemester ? ` · ${semesterOptionLabel(selectedSemester)}` : ''
  }`;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Generate Timetable"
        description="Run the scheduling engine for a semester and inspect the result. A preview is never saved; a draft is generated again on the server and stored as a new immutable version."
      />

      <Alert tone="info" title="Generation is authoritative on the server">
        {GENERATION_DURATION_NOTE}
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Run settings</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SemesterSelect
              id="generate-semester"
              semesters={semesters.items}
              value={semesterId}
              onChange={setSemesterId}
              isLoading={semesters.status === 'loading'}
              disabled={isPreviewing || isDrafting}
            />
            <ScopeSelect
              id="generate-scope"
              value={scope}
              onChange={setScope}
              allowCollege={allowCollege}
              disabled={isPreviewing || isDrafting}
            />
            {showDepartmentChoices ? (
              <DepartmentSelect
                id="generate-department"
                departments={departments.items}
                value={departmentId}
                onChange={setSelectedDepartmentId}
                isLoading={departments.status === 'loading'}
                fixedDepartment={fixedDepartment}
              />
            ) : null}
            <TimeLimitInput
              id="generate-time-limit"
              value={scope === 'COLLEGE' ? collegeLimit : departmentLimit}
              onChange={scope === 'COLLEGE' ? setCollegeLimit : setDepartmentLimit}
              min={scope === 'COLLEGE' ? COLLEGE_TIME_LIMIT.min : DEPARTMENT_TIME_LIMIT.min}
              max={scope === 'COLLEGE' ? COLLEGE_TIME_LIMIT.max : DEPARTMENT_TIME_LIMIT.max}
              backendDefault={
                scope === 'COLLEGE'
                  ? COLLEGE_TIME_LIMIT.default
                  : DEPARTMENT_TIME_LIMIT.default
              }
              disabled={isPreviewing || isDrafting}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Scope: {scope === 'COLLEGE' ? 'the whole semester across every department' : 'one department'}.
            No seed, worker count or solver option is configurable.
          </p>
        </CardBody>
      </Card>

      {/* --- Preview: never persisted --- */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Preview</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <PreviewNotice />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void runPreview()} isLoading={isPreviewing} disabled={!canPreview}>
              {isPreviewing ? 'Solving…' : 'Generate preview'}
            </Button>
            {isPreviewing ? (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                Running the solver for {runningScopeSummary}. Wait for the response; progress is not
                streamed.
              </span>
            ) : null}
          </div>

          {previewFailure ? (
            <GenerationFailureView failure={previewFailure} diagnostics={previewDiagnostics} />
          ) : null}

          {previewRun ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">Preview</Badge>
                <span className="text-sm text-muted-foreground">
                  {formatValidationSemester(previewRun.semester)} ·{' '}
                  {formatScope(previewRun.scope)}
                  {previewRun.departmentCode ? ` · ${previewRun.departmentCode}` : ''}
                </span>
              </div>
              <SolverReportView solver={previewRun.solver} />
              <GenerationSummaryView summary={previewRun.summary} />
              <GenerationDiagnosticsView diagnostics={previewRun.diagnostics} />
              {previewRun.departmentSummaries ? (
                <DepartmentSummariesView summaries={previewRun.departmentSummaries} />
              ) : null}
              <TimetableView
                sessions={sessionsFromPlacements(previewRun.placements)}
                showDepartment={previewRun.scope === 'COLLEGE'}
                emptyMessage="The solver returned no placement."
              />
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* --- Generate and persist a draft version --- */}
      <Card id="persist">
        <CardHeader>
          <CardTitle>Generate & Save New Draft</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Alert tone="warning" title="This stores a new immutable version">
            {PERSIST_DRAFT_MESSAGE}
          </Alert>

          <div className="text-sm">
            <label htmlFor="draft-notes" className="text-xs uppercase tracking-wide text-muted-foreground">
              Notes (optional, up to {NOTES_MAX_LENGTH} characters)
            </label>
            <textarea
              id="draft-notes"
              className="mt-1 min-h-24 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
              value={notes}
              maxLength={NOTES_MAX_LENGTH}
              disabled={isDrafting}
              onChange={(event) => setNotes(event.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {notes.length}/{NOTES_MAX_LENGTH} characters. The note is stored on the version.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void runDraft()} isLoading={isDrafting} disabled={!canDraft}>
              {isDrafting ? 'Generating and saving…' : 'Generate & Save New Draft'}
            </Button>
            {isDrafting ? (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                The server is generating a new timetable and storing it. No preview placement is
                being saved.
              </span>
            ) : null}
          </div>

          {draftFailure ? (
            <GenerationFailureView failure={draftFailure} diagnostics={draftDiagnostics} />
          ) : null}

          {draftOutcome?.persisted && draftOutcome.version ? (
            <div className="space-y-4">
              <Alert tone="success" title={NEW_VERSION_MESSAGE}>
                <p>
                  Version {draftOutcome.version.version_number} of{' '}
                  {draftOutcome.schedule
                    ? `${formatScope(draftOutcome.schedule.scope)}${
                        draftOutcome.schedule.department
                          ? ` · ${draftOutcome.schedule.department.code}`
                          : ''
                      } · ${formatSemester(draftOutcome.schedule.semester)}`
                    : formatValidationSemester(draftOutcome.semester)}
                  .
                </p>
                <p className="mt-1 text-xs">
                  Status {draftOutcome.version.status} · source{' '}
                  {draftOutcome.version.source} · {draftOutcome.version.entry_count} stored
                  session{draftOutcome.version.entry_count === 1 ? '' : 's'}.
                </p>
              </Alert>

              <div className="flex flex-wrap gap-2">
                <Link
                  className="underline text-sm"
                  href={SCHEDULING_ROUTES.versionDetail(draftOutcome.version.id)}
                >
                  View version
                </Link>
                {draftOutcome.schedule ? (
                  <Link
                    className="underline text-sm"
                    href={SCHEDULING_ROUTES.scheduleDetail(draftOutcome.schedule.id)}
                  >
                    View history
                  </Link>
                ) : null}
              </div>

              {draftRun ? (
                <>
                  <SolverReportView solver={draftRun.solver} />
                  <GenerationSummaryView summary={draftRun.summary} />
                  <GenerationDiagnosticsView diagnostics={draftRun.diagnostics} />
                  {draftRun.departmentSummaries ? (
                    <DepartmentSummariesView summaries={draftRun.departmentSummaries} />
                  ) : null}
                  <TimetableView
                    sessions={sessionsFromPlacements(draftRun.placements)}
                    showDepartment={draftRun.scope === 'COLLEGE'}
                    emptyMessage="The stored version contains no placement."
                  />
                </>
              ) : null}
            </div>
          ) : null}

          {draftOutcome && !draftOutcome.persisted && !draftFailure ? (
            <Alert tone="warning" title="Nothing was stored">
              The server returned generated={String(draftOutcome.generated)} and persisted=
              {String(draftOutcome.persisted)}, so no version was created.
            </Alert>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
