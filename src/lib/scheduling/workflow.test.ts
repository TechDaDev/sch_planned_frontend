import { describe, expect, it } from 'vitest';

import {
  actionForStatus,
  actionMatchesStatus,
  describeWorkflowRejection,
  formatWorkflowRejection,
  isPublishableScope,
  isPublishedStatus,
  isStaleRefusal,
  statusAfterAction,
  workflowConfirmation,
} from '@/lib/scheduling/workflow';
import { WORKFLOW_ACTIONS, WORKFLOW_ACTION_LABELS } from '@/lib/scheduling/constants';
import type { ScheduleStatus } from '@/lib/scheduling/types';

describe('workflow state machine', () => {
  it('maps each status to exactly one forward action', () => {
    expect(actionForStatus('DRAFT')).toBe('SUBMIT');
    expect(actionForStatus('SUBMITTED')).toBe('REVIEW');
    expect(actionForStatus('REVIEWED')).toBe('APPROVE');
    expect(actionForStatus('APPROVED')).toBe('PUBLISH');
  });

  it('offers no action for a published version or an unknown status', () => {
    expect(actionForStatus('PUBLISHED')).toBeNull();
    expect(actionForStatus(null)).toBeNull();
    expect(actionForStatus(undefined)).toBeNull();
  });

  it('lands each action in the next stage', () => {
    expect(statusAfterAction('SUBMIT')).toBe('SUBMITTED');
    expect(statusAfterAction('REVIEW')).toBe('REVIEWED');
    expect(statusAfterAction('APPROVE')).toBe('APPROVED');
    expect(statusAfterAction('PUBLISH')).toBe('PUBLISHED');
  });

  it('only accepts an action on its own source status', () => {
    expect(actionMatchesStatus('SUBMIT', 'DRAFT')).toBe(true);
    expect(actionMatchesStatus('SUBMIT', 'SUBMITTED')).toBe(false);
    expect(actionMatchesStatus('PUBLISH', 'APPROVED')).toBe(true);
    expect(actionMatchesStatus('PUBLISH', 'PUBLISHED')).toBe(false);
    // A skipped stage is never accepted.
    expect(actionMatchesStatus('APPROVE', 'SUBMITTED')).toBe(false);
    expect(actionMatchesStatus('REVIEW', 'DRAFT')).toBe(false);
  });

  it('walks the whole chain forward without a shortcut', () => {
    let status: ScheduleStatus = 'DRAFT';
    const visited: ScheduleStatus[] = [status];
    for (let step = 0; step < 4; step += 1) {
      const action = actionForStatus(status);
      expect(action).not.toBeNull();
      expect(actionMatchesStatus(action!, status)).toBe(true);
      status = statusAfterAction(action!);
      visited.push(status);
    }
    expect(visited).toEqual(['DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'PUBLISHED']);
    expect(actionForStatus(status)).toBeNull();
  });

  it('has an action for every declared workflow action', () => {
    for (const action of WORKFLOW_ACTIONS) {
      expect(statusAfterAction(action)).not.toBeNull();
      expect(WORKFLOW_ACTION_LABELS[action]).toBeTruthy();
    }
  });

  it('recognises the published status', () => {
    expect(isPublishedStatus('PUBLISHED')).toBe(true);
    expect(isPublishedStatus('APPROVED')).toBe(false);
    expect(isPublishedStatus(null)).toBe(false);
  });

  it('makes only a college-wide schedule publishable', () => {
    expect(isPublishableScope('COLLEGE')).toBe(true);
    expect(isPublishableScope('DEPARTMENT')).toBe(false);
    expect(isPublishableScope(null)).toBe(false);
    expect(isPublishableScope(undefined)).toBe(false);
  });
});

describe('workflow confirmation copy', () => {
  it('names the scope, semester, version and action', () => {
    const confirmation = workflowConfirmation({
      action: 'PUBLISH',
      versionNumber: 3,
      scheduleScope: 'COLLEGE',
      semesterLabel: 'Semester 1 · 2026–2027',
    });

    expect(confirmation.title).toBe('Publish as official timetable — V3');
    expect(confirmation.detail).toContain('College-wide schedule');
    expect(confirmation.detail).toContain('Semester 1 · 2026–2027');
    expect(confirmation.detail).toContain('V3');
    expect(confirmation.confirmLabel).toBe('Publish');
  });

  it('names the department of a department schedule', () => {
    const confirmation = workflowConfirmation({
      action: 'SUBMIT',
      versionNumber: 1,
      scheduleScope: 'DEPARTMENT',
      semesterLabel: 'Semester 2 · 2026–2027',
      departmentCode: 'BIOAI',
    });

    expect(confirmation.detail).toContain('Department schedule (BIOAI)');
  });

  it('states that publishing moves the pointer and keeps history', () => {
    const confirmation = workflowConfirmation({
      action: 'PUBLISH',
      versionNumber: 4,
      scheduleScope: 'COLLEGE',
      semesterLabel: 'Semester 1 · 2026–2027',
    });

    expect(confirmation.detail).toContain('published-version pointer');
    expect(confirmation.detail).toContain('not deleted');
  });

  it('never claims publishing is possible for a department schedule', () => {
    const confirmation = workflowConfirmation({
      action: 'APPROVE',
      versionNumber: 2,
      scheduleScope: 'DEPARTMENT',
      semesterLabel: 'Semester 1 · 2026–2027',
      departmentCode: 'CS',
    });

    expect(confirmation.detail).toContain('becomes APPROVED');
    expect(confirmation.detail).not.toContain('official published timetable');
  });

  it('falls back to a readable label when the version number is unknown', () => {
    const confirmation = workflowConfirmation({
      action: 'REVIEW',
      versionNumber: null,
      scheduleScope: 'COLLEGE',
      semesterLabel: 'Semester 1 · 2026–2027',
    });

    expect(confirmation.title).toContain('this version');
  });
});

describe('workflow refusals', () => {
  it('labels every documented refusal reason', () => {
    expect(formatWorkflowRejection('INVALID_TRANSITION')).toBe('Wrong workflow stage');
    expect(formatWorkflowRejection('STALE_VERSION')).toBe('A newer version exists');
    expect(formatWorkflowRejection('DEPARTMENT_SCHEDULE_NOT_PUBLISHABLE')).toBe(
      'Department schedule cannot be published',
    );
    expect(formatWorkflowRejection('EMPTY_SCHEDULE_CANNOT_BE_PUBLISHED')).toBe(
      'Empty schedule cannot be published',
    );
    expect(formatWorkflowRejection('SCHEDULE_VALIDATION_FAILED')).toBe('Validation failed');
  });

  it('explains a department publish refusal instead of retrying blindly', () => {
    const help = describeWorkflowRejection('DEPARTMENT_SCHEDULE_NOT_PUBLISHABLE');
    expect(help).toBeTruthy();
    expect(help.toLowerCase()).toContain('college');
  });

  it('treats only out-of-date refusals as stale', () => {
    expect(isStaleRefusal('STALE_VERSION')).toBe(true);
    expect(isStaleRefusal('INVALID_TRANSITION')).toBe(true);
    expect(isStaleRefusal('SCHEDULE_VALIDATION_FAILED')).toBe(false);
    expect(isStaleRefusal('EMPTY_SCHEDULE_CANNOT_BE_PUBLISHED')).toBe(false);
  });
});
