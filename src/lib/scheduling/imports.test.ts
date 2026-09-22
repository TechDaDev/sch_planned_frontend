// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import {
  IMPORT_ACCEPTED_EXTENSION,
  IMPORT_MAX_FILE_BYTES,
} from '@/lib/scheduling/constants';
import {
  blockingIssues,
  buildImportFormData,
  canApplyValidation,
  checkWorkbookFile,
  formatIssueLocation,
  isValidationCurrent,
  readApplyOutcome,
  sameValidationKey,
  validationKey,
  warningIssues,
  type ImportSelection,
} from '@/lib/scheduling/imports';
import { importApplyResult, importIssue, importValidationResult } from '@/test/f4-fixtures';

function workbook(name = 'plan.xlsx', size = 1024): File {
  const file = new File(['x'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  Object.defineProperty(file, 'size', { configurable: true, value: size });
  return file;
}

function selection(overrides: Partial<ImportSelection> = {}): ImportSelection {
  return { departmentId: 2, semesterId: 8, file: workbook(), ...overrides };
}

describe('workbook file check', () => {
  it('accepts a plausible workbook', () => {
    expect(checkWorkbookFile(workbook())).toEqual({ plausible: true, message: null });
  });

  it('requires a file', () => {
    expect(checkWorkbookFile(null).plausible).toBe(false);
    expect(checkWorkbookFile(null).message).toContain(IMPORT_ACCEPTED_EXTENSION);
  });

  it('refuses another extension, including an upper-case mismatch of a real one', () => {
    expect(checkWorkbookFile(workbook('plan.xls')).plausible).toBe(false);
    expect(checkWorkbookFile(workbook('plan.csv')).plausible).toBe(false);
    // Case is normalized, so a differently-cased extension is still the right one.
    expect(checkWorkbookFile(workbook('PLAN.XLSX')).plausible).toBe(true);
  });

  it('refuses an empty file', () => {
    expect(checkWorkbookFile(workbook('plan.xlsx', 0)).message).toBe(
      'The selected file is empty.',
    );
  });

  it('refuses a file larger than the documented limit', () => {
    const check = checkWorkbookFile(workbook('plan.xlsx', IMPORT_MAX_FILE_BYTES + 1));

    expect(check.plausible).toBe(false);
    expect(check.message).toContain('20 MB');
  });

  it('accepts a file exactly at the limit', () => {
    expect(checkWorkbookFile(workbook('plan.xlsx', IMPORT_MAX_FILE_BYTES)).plausible).toBe(true);
  });
});

describe('multipart body', () => {
  it('sends the department, the semester and the file', () => {
    const form = buildImportFormData(selection())!;

    expect(form.get('department')).toBe('2');
    expect(form.get('semester')).toBe('8');
    expect(form.get('file')).toBeInstanceOf(File);
    expect((form.get('file') as File).name).toBe('plan.xlsx');
  });

  it('never lets the workbook choose its target', () => {
    const form = buildImportFormData(selection())!;
    const keys = [...form.keys()];

    expect(keys.sort()).toEqual(['department', 'file', 'semester']);
    expect(keys).not.toContain('scope');
    expect(keys).not.toContain('college');
  });

  it('refuses to build a body without a file, department or semester', () => {
    expect(buildImportFormData(selection({ file: null }))).toBeNull();
    expect(buildImportFormData(selection({ departmentId: null }))).toBeNull();
    expect(buildImportFormData(selection({ semesterId: null }))).toBeNull();
  });
});

describe('validation currency', () => {
  it('keys a validation by department, semester, filename and size', () => {
    expect(validationKey(selection())).toEqual({
      departmentId: 2,
      semesterId: 8,
      fileName: 'plan.xlsx',
      fileSize: 1024,
    });
  });

  it('has no key while an input is missing', () => {
    expect(validationKey(selection({ file: null }))).toBeNull();
    expect(validationKey(selection({ departmentId: null }))).toBeNull();
    expect(validationKey(selection({ semesterId: null }))).toBeNull();
  });

  it('compares keys field by field and treats a missing key as never matching', () => {
    const key = validationKey(selection())!;

    expect(sameValidationKey(key, key)).toBe(true);
    expect(sameValidationKey(key, null)).toBe(false);
    expect(sameValidationKey(null, key)).toBe(false);
  });

  it('marks a previous result stale after any input change', () => {
    const result = importValidationResult({ valid: true, issues: [] });
    const key = validationKey(selection())!;

    expect(isValidationCurrent(result, key, selection())).toBe(true);
    expect(isValidationCurrent(result, key, selection({ departmentId: 99 }))).toBe(false);
    expect(isValidationCurrent(result, key, selection({ semesterId: 9 }))).toBe(false);
    expect(
      isValidationCurrent(result, key, selection({ file: workbook('other.xlsx') })),
    ).toBe(false);
    expect(
      isValidationCurrent(result, key, selection({ file: workbook('plan.xlsx', 2048) })),
    ).toBe(false);
  });

  it('has no current result before the first validation', () => {
    expect(isValidationCurrent(null, null, selection())).toBe(false);
  });
});

describe('applying a validated import', () => {
  it('blocks an apply when errors were reported', () => {
    const result = importValidationResult({ valid: false });
    const key = validationKey(selection())!;

    expect(canApplyValidation(result, key, selection())).toBe(false);
  });

  it('allows an apply when only warnings were reported', () => {
    const result = importValidationResult({
      valid: true,
      summary: { sheets: 6, rows: 24, errors: 0, warnings: 2 },
      issues: [importIssue({ severity: 'WARNING' })],
    });
    const key = validationKey(selection())!;

    expect(canApplyValidation(result, key, selection())).toBe(true);
  });

  it('blocks an apply after the selection changed', () => {
    const result = importValidationResult({ valid: true, issues: [] });
    const key = validationKey(selection())!;

    expect(canApplyValidation(result, key, selection({ semesterId: 9 }))).toBe(false);
  });
});

describe('issue severity buckets', () => {
  it('separates blocking errors from warnings', () => {
    const issues = [
      importIssue({ severity: 'ERROR' }),
      importIssue({ code: 'GROUP_WITHOUT_STAGE', severity: 'WARNING' }),
    ];

    expect(blockingIssues(issues)).toHaveLength(1);
    expect(blockingIssues(issues)[0]!.severity).toBe('ERROR');
    expect(warningIssues(issues)).toHaveLength(1);
    expect(warningIssues(issues)[0]!.code).toBe('GROUP_WITHOUT_STAGE');
  });
});

describe('issue locations', () => {
  it('names the sheet, the row and the column', () => {
    expect(formatIssueLocation(importIssue())).toBe('courses · row 4 · code');
    expect(formatIssueLocation(importIssue({ column: null }))).toBe('courses · row 4');
  });

  it('describes a workbook-level issue as covering the whole sheet', () => {
    expect(formatIssueLocation(importIssue({ row: 0 }))).toBe('courses · whole sheet');
    expect(formatIssueLocation(importIssue({ sheet: '', row: 0 }))).toBe(
      'Workbook · whole sheet',
    );
  });
});

describe('apply outcome normalization', () => {
  it('keeps the created counts and warnings of a successful apply', () => {
    const outcome = readApplyOutcome(importApplyResult());

    expect(outcome.applied).toBe(true);
    expect(outcome.created?.courses).toBe(3);
    expect(outcome.created?.requirement_capabilities).toBe(2);
    expect(outcome.warnings).toHaveLength(1);
  });

  it('drops the counts of a refused apply and keeps the issues', () => {
    const outcome = readApplyOutcome(
      importApplyResult({
        applied: false,
        created: {
          courses: 0,
          student_groups: 0,
          offerings: 0,
          components: 0,
          component_group_links: 0,
          teaching_assignments: 0,
          room_requirements: 0,
          requirement_capabilities: 0,
        },
        warnings: [],
        issues: [importIssue()],
      }),
    );

    expect(outcome.applied).toBe(false);
    expect(outcome.created).toBeNull();
    expect(outcome.issues).toHaveLength(1);
    expect(outcome.issues[0]!.code).toBe('DUPLICATE_COURSE_CODE');
  });
});
