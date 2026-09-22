// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { extractFilename, sanitizeDownloadFilename } from '@/lib/api/client';

/**
 * A `Content-Disposition` filename reaches a browser download attribute, so it is
 * treated as untrusted input even though it comes from our own backend.
 */
describe('download filename sanitization', () => {
  it('keeps an ordinary name unchanged', () => {
    expect(sanitizeDownloadFilename('schedule_version.xlsx')).toBe('schedule_version.xlsx');
    expect(sanitizeDownloadFilename('published_schedule.pdf')).toBe('published_schedule.pdf');
  });

  it('drops every directory component', () => {
    expect(sanitizeDownloadFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeDownloadFilename('/var/tmp/report.xlsx')).toBe('report.xlsx');
    expect(sanitizeDownloadFilename('..\\..\\windows\\system32\\config')).toBe('config');
    expect(sanitizeDownloadFilename('a/b/c/report.pdf')).toBe('report.pdf');
  });

  it('strips control characters that would break the header', () => {
    expect(sanitizeDownloadFilename('report\r\ninjected.xlsx')).toBe('reportinjected.xlsx');
    expect(sanitizeDownloadFilename('re\u0000port.xlsx')).toBe('report.xlsx');
    expect(sanitizeDownloadFilename('tab\tname.pdf')).toBe('tabname.pdf');
  });

  it('strips quote characters that could close the header value', () => {
    expect(sanitizeDownloadFilename('report".xlsx')).toBe('report.xlsx');
    expect(sanitizeDownloadFilename("report'.pdf")).toBe('report.pdf');
    expect(sanitizeDownloadFilename('report`.pdf')).toBe('report.pdf');
  });

  it('strips characters that are invalid in a Windows filename', () => {
    expect(sanitizeDownloadFilename('re<port>|name?.xlsx')).toBe('reportname.xlsx');
    expect(sanitizeDownloadFilename('a:b*c.pdf')).toBe('abc.pdf');
  });

  it('refuses a name that is only dots or dots and spaces', () => {
    expect(sanitizeDownloadFilename('.')).toBeNull();
    expect(sanitizeDownloadFilename('..')).toBeNull();
    expect(sanitizeDownloadFilename('  ..  ')).toBeNull();
    expect(sanitizeDownloadFilename('...')).toBeNull();
    expect(sanitizeDownloadFilename('')).toBeNull();
  });

  it('refuses a reserved device name', () => {
    expect(sanitizeDownloadFilename('CON')).toBeNull();
    expect(sanitizeDownloadFilename('nul.txt')).toBeNull();
    expect(sanitizeDownloadFilename('LPT1.pdf')).toBeNull();
    expect(sanitizeDownloadFilename('nul.xlsx')).toBeNull();
  });

  it('bounds the length', () => {
    const long = `${'a'.repeat(400)}.xlsx`;

    expect(sanitizeDownloadFilename(long)!.length).toBe(120);
  });

  it('removes a leading dot so no hidden file is produced', () => {
    expect(sanitizeDownloadFilename('.hidden.xlsx')).toBe('hidden.xlsx');
  });
});

describe('Content-Disposition parsing', () => {
  it('reads a quoted filename', () => {
    expect(extractFilename('attachment; filename="report.xlsx"')).toBe('report.xlsx');
  });

  it('reads an unquoted filename', () => {
    expect(extractFilename('attachment; filename=report.pdf')).toBe('report.pdf');
  });

  it('reads the RFC 5987 extended form', () => {
    expect(extractFilename("attachment; filename*=UTF-8''report%20final.xlsx")).toBe(
      'report final.xlsx',
    );
  });

  it('returns null when no filename is present', () => {
    expect(extractFilename(null)).toBeNull();
    expect(extractFilename('attachment')).toBeNull();
  });

  it('returns null for a malformed percent-encoded name', () => {
    expect(extractFilename("attachment; filename*=UTF-8''%E0%A4%A")).toBeNull();
  });

  it('sanitizes a traversal attempt out of the header', () => {
    expect(extractFilename('attachment; filename="../../../etc/passwd"')).toBe('passwd');
    expect(extractFilename("attachment; filename*=UTF-8''..%2F..%2Fsecret.xlsx")).toBe(
      'secret.xlsx',
    );
  });

  it('never treats a percent-encoded separator in the plain form as a path', () => {
    // Only the extended form is percent-decoded, so this stays a literal name with no
    // directory component and no separator the operating system would honour.
    const name = extractFilename('attachment; filename="..%2f..%2fsecret.xlsx"');

    // The leading dots are stripped as well, so the result is a plain name.
    expect(name).toBe('%2f..%2fsecret.xlsx');
    expect(name).not.toContain('/');
    expect(name).not.toContain('\\');
  });

  it('sanitizes a name carrying a header injection attempt', () => {
    expect(extractFilename('attachment; filename="report\nSet-Cookie: a=b.xlsx"')).toBe(
      'reportSet-Cookie a=b.xlsx',
    );
  });
});
