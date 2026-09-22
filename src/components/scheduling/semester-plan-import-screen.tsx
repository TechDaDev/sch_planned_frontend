'use client';

import * as React from 'react';

import { useAcademicUser } from '@/components/academic/use-academic-user';
import { ExportButtons } from '@/components/scheduling/export-buttons';
import { IssueList, type IssueRow } from '@/components/scheduling/issue-list';
import { DepartmentSelect, SemesterSelect } from '@/components/scheduling/scope-controls';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';
import { departmentsApi, semestersApi } from '@/lib/academic/api';
import type { Department, Semester } from '@/lib/academic/types';
import { useCollection } from '@/lib/academic/use-collection';
import { ApiClientError, getApiErrorMessage } from '@/lib/api/errors';
import { semesterPlanImportApi } from '@/lib/scheduling/api';
import {
  IMPORT_ACCEPTED_EXTENSION,
  IMPORT_CREATED_FIELDS,
  IMPORT_REVALIDATION_NOTICE,
  IMPORT_SAFETY_NOTICE,
  IMPORT_VALIDATION_STALE_NOTICE,
} from '@/lib/scheduling/constants';
import {
  buildImportFormData,
  canApplyValidation,
  checkWorkbookFile,
  blockingIssues,
  formatIssueLocation,
  isValidationCurrent,
  readApplyOutcome,
  validationKey,
  warningIssues,
  type ImportSelection,
  type ImportValidationKey,
} from '@/lib/scheduling/imports';
import { importDepartmentScope, canImportSemesterPlan } from '@/lib/scheduling/permissions';
import type {
  ImportIssue,
  SemesterPlanApplyResult,
  SemesterPlanValidationResult,
} from '@/lib/scheduling/types';

function toIssueRows(issues: readonly ImportIssue[]): IssueRow[] {
  return issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    location: formatIssueLocation(issue),
    details: issue.details,
  }));
}

/**
 * Semester teaching plan import.
 *
 * The flow is deliberately validate-then-apply: the workbook is validated first, the
 * issues are shown with their sheet and row, and only a validation that passed for the
 * current file, department and semester enables the apply action. Apply re-reads and
 * fully re-validates the workbook on the server, so the displayed result is guidance
 * rather than authority, and no validation token is sent because none exists.
 *
 * The import is create-only: it creates setup, never placements, never overwrites an
 * existing record and never creates instructors or rooms.
 */
export function SemesterPlanImportScreen() {
  const { user, capability } = useAcademicUser();

  const loadDepartments = React.useCallback(
    (signal: AbortSignal) => departmentsApi.list(signal),
    [],
  );
  const loadSemesters = React.useCallback((signal: AbortSignal) => semestersApi.list(signal), []);
  const departments = useCollection<Department>(loadDepartments);
  const semesters = useCollection<Semester>(loadSemesters);

  const scope = importDepartmentScope(capability);
  const [chosenDepartmentId, setChosenDepartmentId] = React.useState<number | null>(null);
  const [semesterId, setSemesterId] = React.useState<number | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = React.useState(0);

  const [validation, setValidation] = React.useState<SemesterPlanValidationResult | null>(null);
  const [validatedKey, setValidatedKey] = React.useState<ImportValidationKey | null>(null);
  const [applyResult, setApplyResult] = React.useState<SemesterPlanApplyResult | null>(null);
  const [applyRefusal, setApplyRefusal] = React.useState<SemesterPlanApplyResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);
  const [isApplying, setIsApplying] = React.useState(false);

  const departmentId = scope.mayChoose ? chosenDepartmentId : scope.fixed;
  const selection: ImportSelection = { departmentId, semesterId, file };
  const fileCheck = checkWorkbookFile(file);
  const validationCurrent = isValidationCurrent(validation, validatedKey, selection);
  const canApply =
    canApplyValidation(validation, validatedKey, selection) &&
    !isApplying &&
    !isValidating;

  /** Any change to the file, department or semester discards the previous result. */
  const resetValidation = () => {
    setValidation(null);
    setValidatedKey(null);
    setApplyResult(null);
    setApplyRefusal(null);
    setError(null);
  };

  if (!canImportSemesterPlan(capability)) {
    return (
      <RestrictedState
        title="Semester plan import is not available for your role"
        description="Only college administrators and department administrators may import a teaching plan."
      />
    );
  }

  const runValidate = async () => {
    const form = buildImportFormData(selection);
    if (form === null) {
      setError('Choose a department, a semester and a workbook first.');
      return;
    }
    setIsValidating(true);
    setError(null);
    setValidation(null);
    setValidatedKey(null);
    setApplyResult(null);
    setApplyRefusal(null);
    try {
      const result = await semesterPlanImportApi.validate(form);
      setValidation(result);
      setValidatedKey(validationKey(selection));
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setIsValidating(false);
    }
  };

  const runApply = async () => {
    const form = buildImportFormData(selection);
    if (form === null || !canApply) {
      return;
    }
    setIsApplying(true);
    setError(null);
    setApplyRefusal(null);
    try {
      const result = await semesterPlanImportApi.apply(form);
      setApplyResult(result);
      setValidation(null);
      setValidatedKey(null);
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 400) {
        const body = cause.payload;
        if (body !== null && typeof body === 'object' && 'applied' in body) {
          setApplyRefusal(body as SemesterPlanApplyResult);
          return;
        }
      }
      setError(getApiErrorMessage(cause));
    } finally {
      setIsApplying(false);
    }
  };

  const refusal = applyRefusal ? readApplyOutcome(applyRefusal) : null;
  const outcome = applyResult ? readApplyOutcome(applyResult) : null;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Semester Teaching Plan Import"
        description="Create a semester's teaching-plan setup from an .xlsx workbook."
      />

      <Alert tone="info" title="What an import does">
        <ul className="list-disc pl-5">
          {IMPORT_SAFETY_NOTICE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Template</CardTitle>
          <CardDescription>
            The template contains the documented sheets and empty data sheets. Uploading the
            untouched template validates to zero rows and applies nothing.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <ExportButtons
            kind="template"
            fetchXlsx={(signal) => semesterPlanImportApi.template(signal)}
            xlsxLabel="Download the .xlsx template"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workbook and target</CardTitle>
          <CardDescription>
            The department comes from this form, never from the workbook, so a spreadsheet
            cannot choose where it lands.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <DepartmentSelect
              id="import-department"
              departments={departments.items}
              value={departmentId}
              onChange={setChosenDepartmentId}
              isLoading={departments.status === 'loading'}
              fixedDepartment={scope.mayChoose ? null : (user?.department ?? null)}
            />
            <SemesterSelect
              id="import-semester"
              semesters={semesters.items}
              value={semesterId}
              onChange={(value) => {
                resetValidation();
                setSemesterId(value);
              }}
              isLoading={semesters.status === 'loading'}
            />
          </div>

          <div className="text-sm">
            <label
              htmlFor="import-file"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Workbook ({IMPORT_ACCEPTED_EXTENSION})
            </label>
            <input
              key={fileInputKey}
              id="import-file"
              type="file"
              accept={IMPORT_ACCEPTED_EXTENSION}
              className="mt-1 block w-full text-sm"
              onChange={(event) => {
                resetValidation();
                setFile(event.target.files?.[0] ?? null);
              }}
            />
            {file ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {file.name} · {Math.round(file.size / 1024)} KB
              </p>
            ) : null}
            {file && !fileCheck.plausible && fileCheck.message ? (
              <p className="mt-1 text-xs text-danger" role="alert">
                {fileCheck.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
              onClick={() => void runValidate()}
              disabled={isValidating || isApplying || departmentId === null || semesterId === null || !fileCheck.plausible}
            >
              {isValidating ? 'Validating…' : 'Validate workbook'}
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md border border-line bg-surface px-4 text-sm font-medium disabled:opacity-60"
              onClick={() => void runApply()}
              disabled={!canApply}
            >
              {isApplying ? 'Applying…' : 'Apply validated import'}
            </button>
            {file ? (
              <button
                type="button"
                className="text-xs underline"
                onClick={() => {
                  setFileInputKey((value) => value + 1);
                  resetValidation();
                  setFile(null);
                }}
              >
                Clear the selected file
              </button>
            ) : null}
          </div>

          {validation && !validationCurrent ? (
            <Alert tone="warning" title="Validation is out of date">
              {IMPORT_VALIDATION_STALE_NOTICE}
            </Alert>
          ) : null}

          <p className="text-xs text-muted-foreground">{IMPORT_REVALIDATION_NOTICE}</p>
        </CardBody>
      </Card>

      {error ? (
        <Alert tone="danger" title="The request could not be completed">
          {error}
        </Alert>
      ) : null}

      {refusal ? (
        <Alert tone="danger" title="The workbook was refused and nothing was written">
          {refusal.summary ? (
            <p className="text-xs">
              {refusal.summary.sheets} sheets · {refusal.summary.rows} rows ·{' '}
              {refusal.summary.errors} errors · {refusal.summary.warnings} warnings
            </p>
          ) : null}
          <div className="mt-3">
            <IssueList issues={toIssueRows(refusal.issues)} label="Import issues" />
          </div>
        </Alert>
      ) : null}

      {validation ? (
        <Card>
          <CardHeader>
            <CardTitle>Validation result</CardTitle>
            <CardDescription>
              Warnings do not block an apply; errors do. Sheet and row are shown so the
              workbook can be fixed at the right place.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Sheets</dt>
                <dd>{validation.summary.sheets}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Rows</dt>
                <dd>{validation.summary.rows}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Errors</dt>
                <dd>{validation.summary.errors}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Warnings
                </dt>
                <dd>{validation.summary.warnings}</dd>
              </div>
            </dl>

            <p className="text-sm">
              {validation.valid
                ? 'No blocking error was found. The import may be applied.'
                : `${blockingIssues(validation.issues).length} blocking error(s) must be fixed before the import can be applied.`}
            </p>

            <IssueList
              issues={toIssueRows(validation.issues)}
              label="Import issues"
              emptyMessage="No issue was reported for this workbook."
            />

            {warningIssues(validation.issues).length > 0 && validation.valid ? (
              <p className="text-xs text-muted-foreground">
                {warningIssues(validation.issues).length} warning(s) will not stop the import.
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {outcome && applyResult ? (
        <Card>
          <CardHeader>
            <CardTitle>Import applied</CardTitle>
            <CardDescription>
              The import is create-only. These are the records it created; nothing existing
              was updated.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            {applyResult.department || applyResult.semester ? (
              <p className="text-sm">
                {applyResult.department?.code ?? '—'} ·{' '}
                {applyResult.semester?.academic_year ?? ''}{' '}
                {applyResult.semester?.number ? `Semester ${applyResult.semester.number}` : ''}
              </p>
            ) : null}
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {IMPORT_CREATED_FIELDS.map((field) => (
                <div key={field.key}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd>{outcome.created?.[field.key] ?? 0}</dd>
                </div>
              ))}
            </dl>
            {outcome.warnings.length > 0 ? (
              <IssueList
                issues={toIssueRows(outcome.warnings)}
                filterable={false}
                label="Import warnings"
              />
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
