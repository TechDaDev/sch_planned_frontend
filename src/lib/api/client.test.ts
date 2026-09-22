import { describe, expect, it } from 'vitest';

import {
  apiFetch,
  apiFetchBinary,
  extractFilename,
  PROXY_BASE_PATH,
  toProxyPath,
} from '@/lib/api/client';
import { ApiClientError } from '@/lib/api/errors';
import { binaryResponse, installFetchMock, jsonResponse, textResponse } from '@/test/fetch-mock';

describe('toProxyPath', () => {
  it('builds same-origin proxy paths', () => {
    expect(toProxyPath('academics/rooms')).toBe(`${PROXY_BASE_PATH}/academics/rooms`);
    expect(toProxyPath('/academics/rooms/')).toBe(`${PROXY_BASE_PATH}/academics/rooms`);
    expect(toProxyPath('reports/2026/export')).toBe(
      `${PROXY_BASE_PATH}/reports/2026/export`,
    );
  });

  it('encodes unsafe characters', () => {
    expect(toProxyPath('academics/semester 1')).toBe(
      `${PROXY_BASE_PATH}/academics/semester%201`,
    );
  });

  it('refuses auth token endpoints', () => {
    expect(() => toProxyPath('auth/login')).toThrow(ApiClientError);
    expect(() => toProxyPath('auth/refresh')).toThrow(ApiClientError);
    expect(() => toProxyPath('')).toThrow(ApiClientError);
  });
});

describe('apiFetch', () => {
  it('calls the same-origin proxy with the requested method and body', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY_BASE_PATH}/academics/rooms`,
        method: 'POST',
        handler: () => jsonResponse({ id: 1 }, 201),
      },
    ]);

    const created = await apiFetch<{ id: number }>('academics/rooms', {
      method: 'POST',
      json: { name: 'Lab 1' },
    });

    expect(created).toEqual({ id: 1 });
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.init.credentials).toBe('same-origin');
    expect(mock.calls[0]?.init.body).toBe(JSON.stringify({ name: 'Lab 1' }));
  });

  it('normalizes backend failures into ApiClientError', async () => {
    installFetchMock([
      {
        url: `${PROXY_BASE_PATH}/academics/rooms`,
        handler: () =>
          jsonResponse(
            { detail: 'Not allowed.', request_id: 'req-7' },
            403,
          ),
      },
    ]);

    await expect(apiFetch('academics/rooms')).rejects.toMatchObject({
      status: 403,
      detail: 'Not allowed.',
      requestId: 'req-7',
    });
  });

  it('keeps non-JSON error bodies safe', async () => {
    installFetchMock([
      {
        url: `${PROXY_BASE_PATH}/academics/rooms`,
        handler: () => textResponse('<html>Internal Server Error</html>', 500, 'text/html'),
      },
    ]);

    await expect(apiFetch('academics/rooms')).rejects.toMatchObject({
      status: 500,
      detail: 'The server encountered an error.',
    });
  });

  it('returns undefined for 204 responses', async () => {
    installFetchMock([
      {
        url: `${PROXY_BASE_PATH}/academics/rooms/1`,
        method: 'DELETE',
        handler: () => new Response(null, { status: 204 }),
      },
    ]);

    await expect(
      apiFetch('academics/rooms/1', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });
});

describe('apiFetchBinary', () => {
  it('preserves bytes, content type and download filename', async () => {
    const bytes = new Uint8Array([80, 75, 3, 4]);
    installFetchMock([
      {
        url: `${PROXY_BASE_PATH}/reports/export`,
        handler: () =>
          binaryResponse(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', {
            'content-disposition': 'attachment; filename="report.xlsx"',
          }),
      },
    ]);

    const download = await apiFetchBinary('reports/export');
    expect(download.filename).toBe('report.xlsx');
    expect(download.contentType).toContain('spreadsheetml');
    expect(new Uint8Array(await download.blob.arrayBuffer())).toEqual(bytes);
  });

  it('reads a UTF-8 encoded filename', () => {
    expect(extractFilename("attachment; filename*=UTF-8''%D8%A7%D9%84%D8%AA%D9%82%D8%B1%D9%8A%D8%B1.xlsx")).toBe(
      'التقرير.xlsx',
    );
    expect(extractFilename(null)).toBeNull();
    expect(extractFilename('attachment')).toBeNull();
  });
});
