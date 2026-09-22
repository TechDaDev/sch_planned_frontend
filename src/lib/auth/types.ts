/**
 * Backend response types for the authenticated identity.
 *
 * Field names mirror the accepted backend exactly:
 * `CurrentUserSerializer` and `DepartmentSummarySerializer`
 * (Backend API v1.0.0, `/api/me/`).
 */

import { parseUserRole, type UserRole } from '@/lib/roles';

/** `DepartmentSummarySerializer` fields: `id`, `name`, `code`. */
export interface DepartmentSummary {
  id: number;
  name: string;
  code: string;
}

/** `CurrentUserSerializer` response of `GET /api/me/`. */
export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  department: DepartmentSummary | null;
}

export type CurrentUserParseResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; reason: 'unsupported_role' | 'malformed_response' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' ? value : null;
}

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseDepartment(value: unknown): DepartmentSummary | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const id = readNumber(value, 'id');
  const name = readString(value, 'name');
  const code = readString(value, 'code');
  if (id === null || name === null || code === null) {
    return undefined;
  }
  return { id, name, code };
}

/**
 * Narrow an untrusted `/api/me/` payload into a `CurrentUser`.
 *
 * Unknown roles are rejected (`unsupported_role`) so a role the frontend does
 * not understand can never be treated as an authenticated application session.
 */
export function parseCurrentUser(value: unknown): CurrentUserParseResult {
  if (!isRecord(value)) {
    return { ok: false, reason: 'malformed_response' };
  }

  // A missing or non-string role means the payload is not a user payload at
  // all; a role the backend never defined is a different, safe failure.
  if (typeof value.role !== 'string') {
    return { ok: false, reason: 'malformed_response' };
  }
  const role = parseUserRole(value.role);
  if (role === null) {
    return { ok: false, reason: 'unsupported_role' };
  }

  const id = readNumber(value, 'id');
  const username = readString(value, 'username');
  const department = parseDepartment(value.department ?? null);

  if (id === null || username === null || department === undefined) {
    return { ok: false, reason: 'malformed_response' };
  }

  return {
    ok: true,
    user: {
      id,
      username,
      email: readString(value, 'email') ?? '',
      first_name: readString(value, 'first_name') ?? '',
      last_name: readString(value, 'last_name') ?? '',
      full_name: readString(value, 'full_name') ?? username,
      role,
      department,
    },
  };
}
