import { describe, expect, it } from 'vitest';

import {
  actorAccountRemoved,
  auditMetadataEntries,
  formatAuditAction,
  formatAuditActor,
  formatAuditDepartment,
  formatAuditSchedule,
  formatAuditSemester,
  formatAuditTimestamp,
  formatAuditVersion,
  formatMetadataValue,
  hasAuditMetadata,
  isCollegeWideEvent,
  isDepartmentEvent,
} from '@/lib/scheduling/audit';
import { AUDIT_ACTIONS } from '@/lib/scheduling/constants';
import { SEMESTER_SUMMARY } from '@/test/scheduling-fixtures';
import { auditEvent } from '@/test/f4-fixtures';

describe('audit action labels', () => {
  it('labels every documented audited operation', () => {
    expect(formatAuditAction('MANUAL_EDIT_APPLIED')).toBe('Manual edit applied');
    expect(formatAuditAction('SCHEDULE_SUBMITTED')).toBe('Schedule version submitted');
    expect(formatAuditAction('SCHEDULE_PUBLISHED')).toBe('Schedule version published');
    expect(formatAuditAction('SEMESTER_PLAN_IMPORTED')).toBe('Semester teaching plan imported');
  });

  it('has a label for each declared action and prints an unknown one unchanged', () => {
    for (const action of AUDIT_ACTIONS) {
      expect(formatAuditAction(action)).not.toBe(action);
    }
    expect(formatAuditAction('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
  });
});

describe('actor identity', () => {
  it('uses the event-time snapshot, not the current account', () => {
    expect(formatAuditActor({ id: 7, username_snapshot: 'r.salim', role_snapshot: 'SCHEDULER' })).toBe(
      'r.salim (SCHEDULER)',
    );
  });

  it('stays readable after the account was removed', () => {
    const actor = { id: null, username_snapshot: 'r.salim', role_snapshot: 'SCHEDULER' };

    expect(actorAccountRemoved(actor)).toBe(true);
    expect(formatAuditActor(actor)).toBe('r.salim (SCHEDULER)');
  });

  it('does not claim removal for a live account or a missing actor', () => {
    expect(actorAccountRemoved({ id: 7, username_snapshot: 'r.salim', role_snapshot: 'SCHEDULER' })).toBe(
      false,
    );
    expect(actorAccountRemoved(null)).toBe(false);
    expect(formatAuditActor(null)).toBe('Unknown actor');
  });

  it('survives a snapshot with an empty role', () => {
    expect(formatAuditActor({ id: 1, username_snapshot: 'r.salim', role_snapshot: '' })).toBe(
      'r.salim',
    );
    expect(formatAuditActor({ id: 1, username_snapshot: '', role_snapshot: 'VIEWER' })).toBe(
      'unknown (VIEWER)',
    );
  });
});

describe('audit event fields', () => {
  it('formats the timestamp without locale drift', () => {
    expect(formatAuditTimestamp('2026-09-21T12:00:00Z')).toBe('2026-09-21 12:00');
    expect(formatAuditTimestamp('2026-09-21 12:34:56')).toBe('2026-09-21 12:34');
    expect(formatAuditTimestamp(null)).toBe('—');
  });

  it('names the schedule and the version', () => {
    expect(formatAuditSchedule(auditEvent())).toBe('#300 · Department');
    expect(
      formatAuditSchedule(
        auditEvent({ schedule: { id: 12, scope: 'COLLEGE', semester_id: 8, department_id: null } }),
      ),
    ).toBe('#12 · College-wide');
    expect(formatAuditSchedule(auditEvent({ schedule: null }))).toBe('—');

    expect(formatAuditVersion(auditEvent())).toBe('V2 · DRAFT');
    expect(formatAuditVersion(auditEvent({ schedule_version: null }))).toBe('—');
  });

  it('names the semester from the nested summary', () => {
    expect(formatAuditSemester(auditEvent())).toBe('Semester 1 · 2026–2027');
    expect(formatAuditSemester(auditEvent({ semester: null }))).toBe('—');
  });

  it('names the department, or states its absence', () => {
    expect(formatAuditDepartment(auditEvent())).toBe('BIOAI — Biomedical AI');
    expect(formatAuditDepartment(auditEvent({ department: null }))).toBe('—');
  });

  it('stores a college-wide event without a department', () => {
    const event = auditEvent({ department: null, semester: SEMESTER_SUMMARY });

    expect(isCollegeWideEvent(event)).toBe(true);
    expect(isDepartmentEvent(event)).toBe(false);
  });

  it('recognises a department event', () => {
    expect(isDepartmentEvent(auditEvent())).toBe(true);
    expect(isCollegeWideEvent(auditEvent())).toBe(false);
  });
});

describe('audit metadata rendering', () => {
  it('lists the entries worth showing and drops empty values', () => {
    const event = auditEvent({
      metadata: { changed_entries: 1, base_version: null, note: undefined, room: 'AI-LAB-1' },
    });

    expect(auditMetadataEntries(event).map((entry) => entry.key)).toEqual([
      'changed_entries',
      'room',
    ]);
    expect(hasAuditMetadata(event)).toBe(true);
  });

  it('reports no metadata for an empty payload', () => {
    expect(auditMetadataEntries(auditEvent({ metadata: {} }))).toEqual([]);
    expect(hasAuditMetadata(auditEvent({ metadata: {} }))).toBe(false);
  });

  it('renders primitives as text', () => {
    expect(formatMetadataValue('AI-LAB-1')).toBe('AI-LAB-1');
    expect(formatMetadataValue(12)).toBe('12');
    expect(formatMetadataValue(false)).toBe('false');
    expect(formatMetadataValue(null)).toBe('—');
    expect(formatMetadataValue(undefined)).toBe('—');
  });

  it('joins a list of primitives, stating an empty element rather than printing `null`', () => {
    expect(formatMetadataValue(['A', 'B'])).toBe('A, B');
    expect(formatMetadataValue([1, 2, 3])).toBe('1, 2, 3');
    expect(formatMetadataValue([null, 'A'])).toBe('—, A');
  });

  it('renders a nested value as bounded JSON text', () => {
    expect(formatMetadataValue({ a: 1, b: [2, 3] })).toBe('{"a":1,"b":[2,3]}');
    const long = formatMetadataValue({ text: 'x'.repeat(600) });
    expect(long.length).toBe(398);
    expect(long.endsWith('…')).toBe(true);
  });

  it('never interprets a value as markup', () => {
    const rendered = formatMetadataValue('<img src=x onerror=alert(1)>');

    expect(rendered).toBe('<img src=x onerror=alert(1)>');
    // The value stays a string, so React escapes it rather than parsing it.
    expect(typeof rendered).toBe('string');
  });

  it('survives a value that cannot be serialized', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(formatMetadataValue(cyclic)).toBe('Unrenderable value');
  });
});
