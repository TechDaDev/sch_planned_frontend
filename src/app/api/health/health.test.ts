import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET as live } from '@/app/api/health/live/route';
import { GET as ready } from '@/app/api/health/ready/route';
import { installFetchMock, jsonResponse } from '@/test/fetch-mock';

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/health/live', () => {
  it('answers 200 with a fixed public body', async () => {
    installFetchMock([]);

    const response = await live();

    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ status: 'ok' });
  });

  it('checks no dependency at all', async () => {
    const mock = installFetchMock([]);

    await live();

    expect(mock.calls).toHaveLength(0);
  });

  it('is never cached and names no internal detail', async () => {
    installFetchMock([]);

    const response = await live();
    const text = await response.clone().text();

    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toContain('/home/');
    expect(text).not.toContain('BACKEND');
  });
});

describe('GET /api/health/ready', () => {
  it('answers 200 with status ok when the backend is ready', async () => {
    installFetchMock([
      {
        url: 'http://127.0.0.1:8000/api/health/ready/',
        handler: () => jsonResponse({ status: 'ok' }),
      },
    ]);

    const response = await ready();

    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ status: 'ok' });
  });

  it('answers 503 with status unavailable when the backend reports not ready', async () => {
    installFetchMock([
      {
        url: 'http://127.0.0.1:8000/api/health/ready/',
        handler: () => jsonResponse({ status: 'unavailable' }, 503),
      },
    ]);

    const response = await ready();

    expect(response.status).toBe(503);
    expect(await body(response)).toEqual({ status: 'unavailable' });
  });

  it('answers 503 when the backend body is not the documented shape', async () => {
    installFetchMock([
      {
        url: 'http://127.0.0.1:8000/api/health/ready/',
        handler: () => jsonResponse({ status: 'degraded' }),
      },
    ]);

    const response = await ready();

    expect(response.status).toBe(503);
    expect(await body(response)).toEqual({ status: 'unavailable' });
  });

  it('answers 503 when the backend cannot be reached', async () => {
    installFetchMock([
      {
        url: 'http://127.0.0.1:8000/api/health/ready/',
        handler: () => {
          throw new Error('ECONNREFUSED 127.0.0.1:8000');
        },
      },
    ]);

    const response = await ready();
    const text = await response.clone().text();

    expect(response.status).toBe(503);
    expect(await body(response)).toEqual({ status: 'unavailable' });
    // The connection error string never reaches the caller.
    expect(text).not.toContain('ECONNREFUSED');
    expect(text).not.toContain('127.0.0.1');
  });

  it('never returns the backend URL or an exception string', async () => {
    installFetchMock([
      {
        url: 'http://127.0.0.1:8000/api/health/ready/',
        handler: () =>
          jsonResponse(
            { status: 'unavailable', detail: 'database db-internal:5432 refused' },
            503,
          ),
      },
    ]);

    const response = await ready();
    const text = await response.text();

    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toContain('db-internal');
    expect(text).not.toContain('5432');
  });

  it('is never cached', async () => {
    installFetchMock([
      {
        url: 'http://127.0.0.1:8000/api/health/ready/',
        handler: () => jsonResponse({ status: 'ok' }),
      },
    ]);

    const response = await ready();

    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
