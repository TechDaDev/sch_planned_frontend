/**
 * Semester teaching plan import helpers.
 *
 * The import is create-only and target-scoped: the department comes from the request,
 * never from the workbook, so a spreadsheet cannot choose where it lands. The
 * workbook crosses the BFF as `multipart/form-data`, which the F0 proxy already
 * streams, so no part of it is converted to base64 JSON.
 *
 * Apply re-reads and fully re-validates the workbook server-side, so a validation
 * result kept in this module is guidance for the operator, never an authorization or
 * a substitute for the server's own check.
 */

import {
  IMPORT_ACCEPTED_EXTENSION,
  IMPORT_MAX_FILE_BYTES,
} from '@/lib/scheduling/constants';
import type {
  ImportIssue,
  SemesterPlanApplyResult,
  SemesterPlanValidationResult,
} from '@/lib/scheduling/types';

/** The selected workbook plus the context it was validated against. */
export interface ImportSelection {
  departmentId: number | null;
  semesterId: number | null;
  file: File | null;
}

/** Identity of a validation result, so a later change can be detected. */
export interface ImportValidationKey {
  departmentId: number | null;
  semesterId: number | null;
  fileName: string;
  fileSize: number;
}

export function validationKey(selection: ImportSelection): ImportValidationKey | null {
  if (
    selection.departmentId === null ||
    selection.semesterId === null ||
    selection.file === null
  ) {
    return null;
  }
  return {
    departmentId: selection.departmentId,
    semesterId: selection.semesterId,
    fileName: selection.file.name,
    fileSize: selection.file.size,
  };
}

export function sameValidationKey(
  left: ImportValidationKey | null,
  right: ImportValidationKey | null,
): boolean {
  if (left === null || right === null) {
    return false;
  }
  return (
    left.departmentId === right.departmentId &&
    left.semesterId === right.semesterId &&
    left.fileName === right.fileName &&
    left.fileSize === right.fileSize
  );
}

export interface FileCheck {
  /** True when no obvious mistake is visible; the backend remains authoritative. */
  plausible: boolean;
  message: string | null;
}

/**
 * Client-side guard on the chosen file.
 *
 * It only spares an obvious round trip: the backend validates extension, content and
 * every business rule, and its answer is the one that counts.
 */
export function checkWorkbookFile(file: File | null): FileCheck {
  if (file === null) {
    return { plausible: false, message: 'Choose an .xlsx workbook.' };
  }
  if (!file.name.toLowerCase().endsWith(IMPORT_ACCEPTED_EXTENSION)) {
    return {
      plausible: false,
      message: `Only ${IMPORT_ACCEPTED_EXTENSION} workbooks are accepted.`,
    };
  }
  if (file.size === 0) {
    return { plausible: false, message: 'The selected file is empty.' };
  }
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    return {
      plausible: false,
      message: `The file is larger than ${Math.round(IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB.`,
    };
  }
  return { plausible: true, message: null };
}

/** Build the multipart body of both import endpoints. */
export function buildImportFormData(selection: ImportSelection): FormData | null {
  if (
    selection.file === null ||
    selection.departmentId === null ||
    selection.semesterId === null
  ) {
    return null;
  }
  const form = new FormData();
  form.append('department', String(selection.departmentId));
  form.append('semester', String(selection.semesterId));
  form.append('file', selection.file, selection.file.name);
  return form;
}

/**
 * Whether a validation result still describes the current selection.
 *
 * A changed file, department or semester invalidates the previous result, so the
 * normal Apply action stays disabled until the server has seen the new input.
 */
export function isValidationCurrent(
  result: SemesterPlanValidationResult | null,
  resultKey: ImportValidationKey | null,
  selection: ImportSelection,
): boolean {
  if (result === null) {
    return false;
  }
  return sameValidationKey(resultKey, validationKey(selection));
}

/**
 * Whether the normal Apply action may be offered.
 *
 * Warnings never block an apply; errors do.
 */
export function canApplyValidation(
  result: SemesterPlanValidationResult | null,
  resultKey: ImportValidationKey | null,
  selection: ImportSelection,
): boolean {
  if (!isValidationCurrent(result, resultKey, selection)) {
    return false;
  }
  return result !== null && result.valid;
}

export function blockingIssues(issues: readonly ImportIssue[]): ImportIssue[] {
  return issues.filter((issue) => issue.severity === 'ERROR');
}

export function warningIssues(issues: readonly ImportIssue[]): ImportIssue[] {
  return issues.filter((issue) => issue.severity === 'WARNING');
}

/** Position of an issue, for the row that documents where to look in the sheet. */
export function formatIssueLocation(issue: ImportIssue): string {
  const sheet = issue.sheet && issue.sheet.length > 0 ? issue.sheet : 'Workbook';
  if (issue.row === 0) {
    return `${sheet} · whole sheet`;
  }
  const column = issue.column ? ` · ${issue.column}` : '';
  return `${sheet} · row ${issue.row}${column}`;
}

export interface ApplyOutcome {
  applied: boolean;
  created: SemesterPlanApplyResult['created'] | null;
  warnings: ImportIssue[];
  summary: SemesterPlanApplyResult['summary'] | null;
  issues: ImportIssue[];
}

/** Normalize both apply outcomes (200 applied, 400 refused) into one shape. */
export function readApplyOutcome(result: SemesterPlanApplyResult): ApplyOutcome {
  return {
    applied: result.applied === true,
    created: result.applied === true ? result.created : null,
    warnings: result.warnings ?? [],
    summary: result.summary ?? null,
    issues: result.issues ?? [],
  };
}
