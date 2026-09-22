'use client';

import * as React from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { ApiDownload } from '@/lib/api/client';
import {
  classifyExportFailure,
  fallbackFilename,
  saveDownload,
  type ExportFailure,
  type ExportFormat,
} from '@/lib/scheduling/exports';

export interface ExportButtonsProps {
  /** Which export family the buttons belong to. */
  kind: 'version' | 'published' | 'template';
  /** Fetches the XLSX bytes. Absent for a PDF-only or XLSX-only surface. */
  fetchXlsx?: (signal: AbortSignal) => Promise<ApiDownload>;
  fetchPdf?: (signal: AbortSignal) => Promise<ApiDownload>;
  /** Renders the XLSX button only. */
  xlsxLabel?: string;
  pdfLabel?: string;
  /** False hides the buttons entirely; the backend refuses them anyway. */
  allowed?: boolean;
  disabledReason?: string;
  className?: string;
}

/**
 * Export download buttons.
 *
 * The file is produced by the backend and streamed through the F0 BFF, so the
 * browser never attaches a token and nothing is regenerated in JavaScript. A
 * repeated click while a download is being prepared is disabled, and the specific
 * failures (403, 404, 503 — including the PDF font condition) are stated rather than
 * collapsed into one message.
 */
export function ExportButtons({
  kind,
  fetchXlsx,
  fetchPdf,
  xlsxLabel = 'Download Excel (.xlsx)',
  pdfLabel = 'Download PDF',
  allowed = true,
  disabledReason,
  className,
}: ExportButtonsProps) {
  const [pending, setPending] = React.useState<ExportFormat | null>(null);
  const [failure, setFailure] = React.useState<ExportFailure | null>(null);
  const [savedName, setSavedName] = React.useState<string | null>(null);

  const run = async (format: ExportFormat, fetcher: (signal: AbortSignal) => Promise<ApiDownload>) => {
    if (pending !== null) {
      return;
    }
    setPending(format);
    setFailure(null);
    setSavedName(null);
    const controller = new AbortController();
    try {
      const download = await fetcher(controller.signal);
      const { filename } = saveDownload(download, fallbackFilename(kind, format));
      setSavedName(filename);
    } catch (cause) {
      setFailure(classifyExportFailure(cause, format));
    } finally {
      setPending(null);
    }
  };

  if (!allowed) {
    return disabledReason ? (
      <p className={className ? `${className} text-xs text-muted-foreground` : 'text-xs text-muted-foreground'}>
        {disabledReason}
      </p>
    ) : null;
  }

  return (
    <div className={className ? `${className} space-y-3` : 'space-y-3'}>
      <div className="flex flex-wrap gap-2">
        {fetchXlsx ? (
          <Button
            variant="secondary"
            isLoading={pending === 'xlsx'}
            disabled={pending !== null}
            onClick={() => {
              if (fetchXlsx) {
                void run('xlsx', fetchXlsx);
              }
            }}
          >
            {pending === 'xlsx' ? 'Preparing Excel…' : xlsxLabel}
          </Button>
        ) : null}
        {fetchPdf ? (
          <Button
            variant="secondary"
            isLoading={pending === 'pdf'}
            disabled={pending !== null}
            onClick={() => {
              if (fetchPdf) {
                void run('pdf', fetchPdf);
              }
            }}
          >
            {pending === 'pdf' ? 'Preparing PDF…' : pdfLabel}
          </Button>
        ) : null}
      </div>

      {pending !== null ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          The server is building the document. The download starts when it is ready.
        </p>
      ) : null}

      {savedName ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Downloaded {savedName}.
        </p>
      ) : null}

      {failure ? (
        <Alert tone="danger" title={failure.title}>
          {failure.description}
        </Alert>
      ) : null}
    </div>
  );
}
