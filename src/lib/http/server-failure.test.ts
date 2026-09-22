import { afterEach, describe, expect, it, vi } from 'vitest';

import { ServerConfigurationError } from '@/lib/config/env';
import {
  configurationFailureResponse,
  reportConfigurationFailure,
  withServerFailureHandling,
} from '@/lib/http/server-failure';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('configuration failure handling', () => {
  it('answers 503 without exposing the variable value or the message', async () => {
    const logged: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });

    const response = configurationFailureResponse(
      'POST /api/auth/login',
      new ServerConfigurationError(
        'BACKEND_API_URL',
        'BACKEND_API_URL must be set in a production runtime; no backend host is assumed.',
      ),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(body).toEqual({
      code: 'server_misconfigured',
      detail:
        'The server is not configured to reach its dependencies. Please contact the administrator.',
    });
    // The server log keeps the variable name for the operator, and nothing else.
    const loggedText = logged.flat().join(' ');
    expect(loggedText).toContain('BACKEND_API_URL');
    expect(loggedText).not.toContain('http://');
  });

  it('never returns a message that names an internal host', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = configurationFailureResponse(
      'GET /api/backend',
      new ServerConfigurationError(
        'BACKEND_API_URL',
        'BACKEND_API_URL must be an absolute http(s) URL with a host, without embedded credentials or a fragment.',
      ),
    );
    const text = await response.text();

    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toContain('http://');
    expect(text).not.toContain('at ');
  });
});

describe('unexpected server failure handling', () => {
  it('returns the handler result when nothing throws', async () => {
    const response = await withServerFailureHandling('GET /x', async () =>
      new Response('ok', { status: 200 }),
    );

    expect(response.status).toBe(200);
  });

  it('maps a configuration error to the controlled configuration response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await withServerFailureHandling('GET /x', async () => {
      throw new ServerConfigurationError('BACKEND_API_URL', 'not usable');
    });

    expect(response.status).toBe(503);
    expect((await response.json()) as Record<string, unknown>).toMatchObject({
      code: 'server_misconfigured',
    });
  });

  it('maps any other exception to a generic 500 with a fixed body', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await withServerFailureHandling('GET /x', async () => {
      throw new Error('connection to postgres at db-internal:5432 refused');
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(body).toEqual({
      code: 'internal_error',
      detail: 'The server could not complete the request. Please try again.',
    });
    expect(JSON.stringify(body)).not.toContain('postgres');
    expect(JSON.stringify(body)).not.toContain('db-internal');
  });

  it('logs no request data when an unexpected failure is recorded', async () => {
    const logged: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });

    await withServerFailureHandling('GET /x', async () => {
      throw new Error('boom');
    });

    const loggedText = logged.flat().join(' ');
    expect(loggedText).not.toContain('boom');
    expect(loggedText).toContain('[server]');
  });
});

describe('configuration logging', () => {
  it('records the failing variable for the operator', () => {
    const logged: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });

    reportConfigurationFailure(
      'GET /api/health/ready',
      new ServerConfigurationError('BACKEND_API_URL', 'No usable backend host is configured.'),
    );

    const loggedText = logged.flat().join(' ');
    expect(loggedText).toContain('[configuration]');
    expect(loggedText).toContain('GET /api/health/ready');
    expect(loggedText).toContain('BACKEND_API_URL');
  });
});
