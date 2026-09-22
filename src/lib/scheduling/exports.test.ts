// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '@/lib/api/errors';
import { EXPORT_FALLBACK_FILENAMES, PDF_FONT_UNAVAILABLE_MESSAGE } from '@/lib/scheduling/constants';
import {
  EXPORT_MEDIA_TYPES,
  classifyExportFailure,
  fallbackFilename,
  saveDownload,
} from '@/lib/scheduling/exports';

function apiError(status: number, detail = 'Request failed'): ApiClientError {
  return new ApiClientError({ status, detail });
}

/** jsdom implements neither object-URL call, so both are stubbed. */
function stubObjectUrls() {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:mock'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('export media types and filenames', () => {
  it('names the exact workbook and PDF media types', () => {
    expect(EXPORT_MEDIA_TYPES.xlsx).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(EXPORT_MEDIA_TYPES.pdf).toBe('application/pdf');
  });

  it('has a documented fallback filename for every export kind', () => {
    expect(fallbackFilename('version', 'xlsx')).toBe(EXPORT_FALLBACK_FILENAMES.versionXlsx);
    expect(fallbackFilename('version', 'pdf')).toBe(EXPORT_FALLBACK_FILENAMES.versionPdf);
    expect(fallbackFilename('published', 'xlsx')).toBe(EXPORT_FALLBACK_FILENAMES.publishedXlsx);
    expect(fallbackFilename('published', 'pdf')).toBe(EXPORT_FALLBACK_FILENAMES.publishedPdf);
    expect(fallbackFilename('template', 'xlsx')).toBe(EXPORT_FALLBACK_FILENAMES.template);
  });
});

describe('export failure classification', () => {
  it('reports a 403 as a permission refusal', () => {
    expect(classifyExportFailure(apiError(403), 'xlsx').kind).toBe('permission-denied');
    expect(classifyExportFailure(apiError(403), 'pdf').kind).toBe('permission-denied');
  });

  it('reports a 404 as an unavailable export', () => {
    const failure = classifyExportFailure(apiError(404), 'xlsx');

    expect(failure.kind).toBe('not-found');
    expect(failure.description).toContain('not available');
  });

  it('reports a PDF 503 as the missing-font condition', () => {
    const failure = classifyExportFailure(apiError(503), 'pdf');

    expect(failure.kind).toBe('font-unavailable');
    expect(failure.description).toBe(PDF_FONT_UNAVAILABLE_MESSAGE);
    expect(failure.description).toContain('Excel export is unaffected');
  });

  it('does not report an Excel 503 as a font problem', () => {
    const failure = classifyExportFailure(apiError(503), 'xlsx');

    expect(failure.kind).toBe('unavailable');
    expect(failure.description).not.toBe(PDF_FONT_UNAVAILABLE_MESSAGE);
  });

  it('reports an aborted download separately from a server error', () => {
    expect(classifyExportFailure(apiError(0, 'The request was cancelled.'), 'pdf').kind).toBe(
      'cancelled',
    );
  });

  it('falls back to a generic failure for an unclassified cause', () => {
    expect(classifyExportFailure(new Error('boom'), 'xlsx').kind).toBe('unavailable');
    expect(classifyExportFailure(null, 'xlsx').kind).toBe('unavailable');
  });
});

describe('saving a download', () => {
  it('prefers the backend filename over the fallback', () => {
    stubObjectUrls();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { filename } = saveDownload(
      {
        blob: new Blob(['bytes']),
        filename: 'server-name.xlsx',
        contentType: EXPORT_MEDIA_TYPES.xlsx,
        status: 200,
      },
      EXPORT_FALLBACK_FILENAMES.versionXlsx,
    );

    expect(filename).toBe('server-name.xlsx');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('uses the fallback when the backend sends no filename', () => {
    stubObjectUrls();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { filename } = saveDownload(
      {
        blob: new Blob(['bytes']),
        filename: null,
        contentType: EXPORT_MEDIA_TYPES.pdf,
        status: 200,
      },
      EXPORT_FALLBACK_FILENAMES.publishedPdf,
    );

    expect(filename).toBe(EXPORT_FALLBACK_FILENAMES.publishedPdf);
  });
});
