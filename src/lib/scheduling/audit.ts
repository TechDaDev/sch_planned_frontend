/**
 * Audit trail helpers.
 *
 * The trail is append-only and read-only from the client: there is no create, update
 * or delete helper for an audit event anywhere in this layer.
 *
 * Actor identity comes from the event's own snapshot columns. Current account data is
 * never substituted, because the point of the trail is what was true when the
 * operation happened.
 */

import { AUDIT_ACTION_LABELS } from '@/lib/scheduling/constants';
import type { AuditActor, AuditEvent, AuditAction } from '@/lib/scheduling/types';

export function formatAuditAction(action: AuditAction | string): string {
  return (AUDIT_ACTION_LABELS as Record<string, string>)[action] ?? action;
}

/** `r.salim (SCHEDULER)` from the event-time snapshot. */
export function formatAuditActor(actor: AuditActor | null | undefined): string {
  if (!actor) {
    return 'Unknown actor';
  }
  const username = actor.username_snapshot || 'unknown';
  const role = actor.role_snapshot;
  return role ? `${username} (${role})` : username;
}

/** True when the account was removed after the event was written. */
export function actorAccountRemoved(actor: AuditActor | null | undefined): boolean {
  return actor !== null && actor !== undefined && actor.id === null;
}

/** `2026-09-21 12:00` from an ISO timestamp, without locale drift. */
export function formatAuditTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}` : value;
}

/** `#12 · COLLEGE` for the schedule an event belongs to. */
export function formatAuditSchedule(event: AuditEvent): string {
  if (!event.schedule) {
    return '—';
  }
  const scope = event.schedule.scope === 'COLLEGE' ? 'College-wide' : 'Department';
  return `#${event.schedule.id} · ${scope}`;
}

/** `V3 · APPROVED` for the version an event produced or changed. */
export function formatAuditVersion(event: AuditEvent): string {
  if (!event.schedule_version) {
    return '—';
  }
  return `V${event.schedule_version.version_number} · ${event.schedule_version.status}`;
}

/** `Semester 1 · 2026–2027`, using the nested semester summary. */
export function formatAuditSemester(event: AuditEvent): string {
  if (!event.semester) {
    return '—';
  }
  const year = event.semester.academic_year;
  return `Semester ${event.semester.number} · ${year.start_year}–${year.end_year}`;
}

export function formatAuditDepartment(event: AuditEvent): string {
  return event.department ? `${event.department.code} — ${event.department.name}` : '—';
}

/** Metadata entries worth showing; an empty payload renders nothing prominent. */
export function auditMetadataEntries(
  event: AuditEvent,
): { key: string; value: unknown }[] {
  if (!event.metadata || typeof event.metadata !== 'object') {
    return [];
  }
  return Object.entries(event.metadata)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => ({ key, value }));
}

export function hasAuditMetadata(event: AuditEvent): boolean {
  return auditMetadataEntries(event).length > 0;
}

/**
 * Render one metadata value as text.
 *
 * Only primitives become text, with a bounded JSON rendering for a nested value.
 * Nothing here is interpreted as markup.
 */
export function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const primitives = value.filter(
      (entry) =>
        entry === null ||
        typeof entry === 'string' ||
        typeof entry === 'number' ||
        typeof entry === 'boolean',
    );
    if (primitives.length === value.length) {
      return (
        primitives
          .map((entry) => (entry === null || entry === undefined ? '—' : String(entry)))
          .join(', ') || '—'
      );
    }
  }
  try {
    const encoded = JSON.stringify(value);
    return encoded.length > 400 ? `${encoded.slice(0, 397)}…` : encoded;
  } catch {
    return 'Unrenderable value';
  }
}

/** True when an event belongs to the caller's own department. */
export function isDepartmentEvent(event: AuditEvent): boolean {
  return event.department !== null && event.department !== undefined;
}

/**
 * True for a college-wide event, which carries no department.
 *
 * A department administrator sees only its own department's events, so these are
 * invisible to it by construction rather than filtered in the client.
 */
export function isCollegeWideEvent(event: AuditEvent): boolean {
  return event.department === null || event.department === undefined;
}
