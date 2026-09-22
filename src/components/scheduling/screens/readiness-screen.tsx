'use client';

import * as React from 'react';

import { useAcademicUser } from '@/components/academic/use-academic-user';
import {
  DepartmentSelect,
  ScopeSelect,
  SemesterSelect,
} from '@/components/scheduling/scope-controls';
import { ValidationIssues } from '@/components/scheduling/validation-issues';
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
import { getApiErrorMessage } from '@/lib/api/errors';
import {
  READINESS_NOT_READY_MESSAGE,
  READINESS_READY_MESSAGE,
  READINESS_SCOPE_NOTE,
} from '@/lib/scheduling/constants';
import { formatValidationSemester } from '@/lib/scheduling/formatters';
import {
  canChooseAnyDepartment,
  canRunCollegeValidation,
  canRunDepartmentValidation,
  canRunValidation,
  isDepartmentlessScopedUser,
} from '@/lib/scheduling/permissions';
import { validationApi } from '@/lib/scheduling/api';
import type { PreSchedulingValidationResult, ValidationScope } from '@/lib/scheduling/types';

/**
 * Readiness validation.
 *
 * The panel reports what the validator computed and nothing more: `ready` means
 * no blocking error was found, which is not the same as a feasible timetable. The
 * wording never claims feasibility, because validation places no session.
 */
export function ReadinessScreen() {
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
  const [result, setResult] = React.useState<PreSchedulingValidationResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);

  const allowCollege = canRunCollegeValidation(capability);
  const fixedDepartment = canChooseAnyDepartment(capability)
    ? null
    : (user?.department ?? null);
  const own = ownDepartmentId(capability);

  // A scoped role validates exactly one department, so the value is derived from
  // the account instead of being chosen from a list.
  const departmentId = fixedDepartment
    ? fixedDepartment.id
    : scope === 'COLLEGE'
      ? null
      : selectedDepartmentId;

  if (isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="Readiness validation is scoped to a department for your role, and no department is attached to this account. Ask a college administrator to assign your department."
      />
    );
  }

  if (!canRunValidation(capability)) {
    return (
      <RestrictedState
        title="Readiness validation is not available for your role"
        description="Running validation is an operational action for college administrators, department administrators and schedulers. Your account can read schedule history but not run validation."
      />
    );
  }

  const canSubmit =
    semesterId !== null &&
    !isRunning &&
    (scope === 'COLLEGE'
      ? allowCollege
      : canRunDepartmentValidation(capability, departmentId ?? own));

  const run = async () => {
    if (!canSubmit || semesterId === null) {
      return;
    }
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const payload =
        scope === 'COLLEGE'
          ? { semester: semesterId, scope }
          : { semester: semesterId, scope, department: departmentId ?? own ?? undefined };
      const validation = await validationApi.run(payload);
      setResult(validation);
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Scheduling Readiness"
        description="Check whether the stored data is ready for timetable generation in one semester and scope."
      />

      <Alert tone="info" title="What is checked">
        {READINESS_SCOPE_NOTE}
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Validation scope</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <SemesterSelect
              id="readiness-semester"
              semesters={semesters.items}
              value={semesterId}
              onChange={setSemesterId}
              isLoading={semesters.status === 'loading'}
            />
            <ScopeSelect
              id="readiness-scope"
              value={scope}
              onChange={setScope}
              allowCollege={allowCollege}
              disabled={isRunning}
            />
            <DepartmentSelect
              id="readiness-department"
              departments={departments.items}
              value={departmentId}
              onChange={setSelectedDepartmentId}
              isLoading={departments.status === 'loading'}
              fixedDepartment={fixedDepartment}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void run()} isLoading={isRunning} disabled={!canSubmit}>
              {isRunning ? 'Validating…' : 'Run validation'}
            </Button>
            {scope === 'COLLEGE' && !allowCollege ? (
              <span className="text-xs text-muted-foreground">
                College-wide validation is reserved for college administrators.
              </span>
            ) : null}
            {isRunning ? (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                Validating {scope === 'COLLEGE' ? 'the whole college' : 'the department'}. This is
                a stored-data check and returns no timetable.
              </span>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {error ? (
        <Alert tone="danger" title="Validation could not run">
          {error}
        </Alert>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Validation result</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={result.ready ? 'success' : 'danger'}>
                {result.ready ? 'Ready' : 'Not ready'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {formatValidationSemester(result.semester)} ·{' '}
                {result.scope === 'COLLEGE' ? 'Whole college' : 'One department'}
                {result.department ? ` · ${result.department.code}` : ''}
              </span>
            </div>

            <Alert tone={result.ready ? 'success' : 'warning'}>
              {result.ready ? READINESS_READY_MESSAGE : READINESS_NOT_READY_MESSAGE}
            </Alert>

            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Components checked
                </dt>
                <dd>{result.summary.components_checked}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Errors</dt>
                <dd>{result.summary.errors}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Warnings
                </dt>
                <dd>{result.summary.warnings}</dd>
              </div>
            </dl>

            <p className="text-xs text-muted-foreground">
              Only ERROR issues block generation. Warnings are informational.
            </p>

            <ValidationIssues
              issues={result.issues}
              emptyMessage="No issue was reported for this scope."
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
