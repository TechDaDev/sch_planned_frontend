'use client';

import * as React from 'react';

import { useAcademicUser } from '@/components/academic/use-academic-user';
import { WorkflowPanel } from '@/components/scheduling/workflow-panel';
import { Alert } from '@/components/ui/alert';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeading } from '@/components/ui/page-heading';
import { RestrictedState } from '@/components/ui/states';
import { scheduleVersionsApi, schedulesApi } from '@/lib/scheduling/api';
import { useCollection } from '@/lib/academic/use-collection';
import { formatSemester } from '@/lib/scheduling/formatters';
import {
  availableWorkflowAction,
  canReadScheduleHistory,
  isDepartmentlessScopedUser,
} from '@/lib/scheduling/permissions';
import { isPublishableScope } from '@/lib/scheduling/workflow';
import type {
  ScheduleVersionDetail,
  ScheduleVersionSummary,
} from '@/lib/scheduling/types';
import { useResource } from '@/lib/scheduling/use-resource';

export interface VersionWorkflowScreenProps {
  versionId: number;
}

/**
 * Workflow page of one stored version.
 *
 * It shows the current stage, the validation report against today's configuration, and
 * at most one action. Each transition is separately confirmed and separately sent, and
 * a successful one reloads the version, its history and the validation — no full page
 * reload, and no automatic chaining into the next stage.
 */
export function VersionWorkflowScreen({ versionId }: VersionWorkflowScreenProps) {
  const { capability } = useAcademicUser();

  const loadVersion = React.useCallback(
    (signal: AbortSignal) => scheduleVersionsApi.get(versionId, signal),
    [versionId],
  );
  const versionResource = useResource<ScheduleVersionDetail>(loadVersion);
  const version = versionResource.data;

  const scheduleId = version?.schedule.id ?? null;
  const loadHistory = React.useCallback(
    (signal: AbortSignal) =>
      scheduleId === null
        ? Promise.resolve<ScheduleVersionSummary[]>([])
        : schedulesApi.versions(scheduleId, signal),
    [scheduleId],
  );
  const history = useCollection<ScheduleVersionSummary>(loadHistory);

  const isLatestVersion = React.useMemo(() => {
    if (version === null || history.items.length === 0) {
      return null;
    }
    const newest = history.items.reduce((latest, candidate) =>
      candidate.version_number > latest.version_number ? candidate : latest,
    );
    return newest.id === version.id;
  }, [history.items, version]);

  if (isDepartmentlessScopedUser(capability)) {
    return (
      <RestrictedState
        title="No department is assigned to this account."
        description="Workflow actions are scoped to a department, and none is attached to this account."
      />
    );
  }

  if (!canReadScheduleHistory(capability)) {
    return (
      <RestrictedState
        title="Workflow is not available for your role"
        description="Moving a stored version through the workflow belongs to the college administrator, department administrator and scheduler roles."
      />
    );
  }

  const context = {
    scheduleScope: version?.schedule.scope ?? null,
    scheduleDepartmentId: version?.schedule.department?.id ?? null,
    status: version?.status ?? null,
    isLatestVersion,
  };
  const action = version ? availableWorkflowAction(capability, context) : null;

  return (
    <div className="space-y-6">
      <PageHeading
        title={version ? `Workflow — V${version.version_number}` : `Workflow — version #${versionId}`}
        description="Submit, review, approve and publish are four separate, separately confirmed actions. No stage is skipped and none is chained."
        actions={null}
      />

      {versionResource.error ? (
        <Alert tone="danger" title="Version could not be loaded">
          <p>{versionResource.error.detail}</p>
          <p className="mt-1 text-xs">
            A version outside your scope answers as not found, so its existence is not
            revealed.
          </p>
        </Alert>
      ) : null}

      {version ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Version</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-muted-foreground">
                {version.schedule.scope === 'COLLEGE' ? 'College-wide schedule' : 'Department schedule'}
                {version.schedule.department ? ` (${version.schedule.department.code})` : ''} ·{' '}
                {formatSemester(version.schedule.semester)} · V{version.version_number}
              </p>
            </CardBody>
          </Card>

          <WorkflowPanel
            key={`${versionId}-${version.status}`}
            versionId={versionId}
            status={version.status}
            versionNumber={version.version_number}
            scheduleScope={version.schedule.scope}
            departmentCode={version.schedule.department?.code ?? null}
            semesterLabel={formatSemester(version.schedule.semester)}
            isLatestVersion={isLatestVersion === true}
            action={action}
            publishableScope={isPublishableScope(version.schedule.scope)}
            onTransitioned={() => {
              // Refresh the version and its history without reloading the browser.
              versionResource.reload();
              history.reload();
            }}
          />
        </>
      ) : null}
    </div>
  );
}
