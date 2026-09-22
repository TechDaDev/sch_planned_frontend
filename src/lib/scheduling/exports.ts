/**
 * Binary export helpers.
 *
 * Every export is produced by the backend and streamed through the F0 BFF, which
 * preserves `Content-Type` and `Content-Disposition`. Nothing here rebuilds a
 * workbook or a PDF in JavaScript: the backend export carries its own snapshot and
 * analytics logic, and a client-side reimplementation would be a different document.
 *
 * No token is ever read, attached or downloaded by this module.
 */

import { downloadBlob, type ApiDownload } from '@/lib/api/client';
import { ApiClientError } from '@/lib/api/errors';
import { EXPORT_FALLBACK_FILENAMES, PDF_FONT_UNAVAILABLE_MESSAGE } from '@/lib/scheduling/constants';

export type ExportFormat = 'xlsx' | 'pdf';

export interface ExportOutcome {
  ok: boolean;
  filename: string | null;
  /** Present when the download did not happen. */
  failure: ExportFailure | null;
}

export type ExportFailureKind =
  | 'permission-denied'
  | 'not-found'
  | 'font-unavailable'
  | 'unavailable'
  | 'cancelled';

export interface ExportFailure {
  kind: ExportFailureKind;
  title: string;
  description: string;
}

export const EXPORT_MEDIA_TYPES: Record<ExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

function fallbackFilename(kind: 'version' | 'published' | 'template', format: ExportFormat): string {
  if (kind === 'template') {
    return EXPORT_FALLBACK_FILENAMES.template;
  }
  if (kind === 'published') {
    return format === 'pdf'
      ? EXPORT_FALLBACK_FILENAMES.publishedPdf
      : EXPORT_FALLBACK_FILENAMES.publishedXlsx;
  }
  return format === 'pdf'
    ? EXPORT_FALLBACK_FILENAMES.versionPdf
    : EXPORT_FALLBACK_FILENAMES.versionXlsx;
}

/**
 * Classify a failed export.
 *
 * A `503` on a PDF means the server could not resolve a Unicode-capable font, which
 * is a specific condition an operator can act on. It is stated as such instead of
 * being reported as a generic server error.
 */
export function classifyExportFailure(error: unknown, format: ExportFormat): ExportFailure {
  if (error instanceof ApiClientError) {
    if (error.status === 403) {
      return {
        kind: 'permission-denied',
        title: 'Download not permitted',
        description: 'Your role may not download this export.',
      };
    }
    if (error.status === 404) {
      return {
        kind: 'not-found',
        title: 'Export not available',
        description:
          'The requested version or publication is not available to your account.',
      };
    }
    if (error.status === 503 && format === 'pdf') {
      return {
        kind: 'font-unavailable',
        title: 'PDF could not be produced',
        description: PDF_FONT_UNAVAILABLE_MESSAGE,
      };
    }
    if (error.status === 503) {
      return {
        kind: 'unavailable',
        title: 'Export service unavailable',
        description: 'The server could not produce the export right now. Try again later.',
      };
    }
    if (error.status === 0) {
      return {
        kind: 'cancelled',
        title: 'Download not completed',
        description: error.detail,
      };
    }
  }
  return {
    kind: 'unavailable',
    title: 'Export could not be downloaded',
    description: 'The request failed before the file arrived.',
  };
}

/** Save a downloaded response, preferring the backend filename. */
export function saveDownload(
  download: ApiDownload,
  fallback: string,
): { filename: string } {
  const filename = download.filename ?? fallback;
  downloadBlob(download.blob, filename);
  return { filename };
}

export { fallbackFilename };
