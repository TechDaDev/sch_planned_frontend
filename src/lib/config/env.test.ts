import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BACKEND_GENERATION_TIMEOUT_MS,
  BACKEND_REQUEST_TIMEOUT_MS,
  ServerConfigurationError,
  backendTimeoutMs,
  getBackendApiUrl,
  hasUsableBackendApiUrl,
  isProductionRuntime,
} from '@/lib/config/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

const DEV_FALLBACK = 'http://127.0.0.1:8000';

describe('backend host in development', () => {
  it('falls back to the local Django server when nothing is configured', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BACKEND_API_URL', '');

    expect(isProductionRuntime()).toBe(false);
    expect(getBackendApiUrl()).toBe(DEV_FALLBACK);
  });

  it('uses the configured value and normalizes trailing slashes away', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BACKEND_API_URL', 'http://backend.internal:9000///');

    expect(getBackendApiUrl()).toBe('http://backend.internal:9000');
  });
});

describe('backend host in production', () => {
  it('fails closed when nothing is configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BACKEND_API_URL', '');

    expect(isProductionRuntime()).toBe(true);
    expect(() => getBackendApiUrl()).toThrow(ServerConfigurationError);
    expect(hasUsableBackendApiUrl()).toBe(false);
  });

  it('fails closed when the value is only whitespace', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BACKEND_API_URL', '   ');

    expect(() => getBackendApiUrl()).toThrow(ServerConfigurationError);
  });

  it('never silently targets localhost in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BACKEND_API_URL', '');

    let message = '';
    try {
      getBackendApiUrl();
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).not.toContain('127.0.0.1');
    expect(message).toContain('BACKEND_API_URL');
  });

  it('accepts a configured absolute https URL', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BACKEND_API_URL', 'https://api.example.edu');

    expect(getBackendApiUrl()).toBe('https://api.example.edu');
    expect(hasUsableBackendApiUrl()).toBe(true);
  });
});

describe('backend URL validation', () => {
  const rejected = [
    ['a relative path', '/api'],
    ['a bare host without a scheme', 'backend.internal:8000'],
    ['a non-http scheme', 'ftp://backend.internal'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['embedded credentials', 'https://user:secret@backend.internal'],
    ['a username only', 'https://user@backend.internal'],
    ['a fragment', 'https://backend.internal/#token'],
    ['plain text', 'not a url at all'],
    ['an empty scheme-only value', 'http://'],
  ] as const;

  for (const [label, value] of rejected) {
    it(`rejects ${label}`, () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('BACKEND_API_URL', value);

      expect(() => getBackendApiUrl()).toThrow(ServerConfigurationError);
    });
  }

  it('accepts a URL with a port and a path prefix', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BACKEND_API_URL', 'http://backend.internal:8000/django/');

    expect(getBackendApiUrl()).toBe('http://backend.internal:8000/django');
  });

  it('reports the failing variable without echoing the configured value', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BACKEND_API_URL', 'ftp://secret-host.example');

    try {
      getBackendApiUrl();
      throw new Error('expected a configuration failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ServerConfigurationError);
      expect((error as ServerConfigurationError).variable).toBe('BACKEND_API_URL');
      expect((error as ServerConfigurationError).message).not.toContain('secret-host');
    }
  });
});

describe('backend timeout policy', () => {
  it('uses a finite ordinary timeout', () => {
    expect(Number.isFinite(BACKEND_REQUEST_TIMEOUT_MS)).toBe(true);
    expect(BACKEND_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(backendTimeoutMs('me/')).toBe(BACKEND_REQUEST_TIMEOUT_MS);
    expect(backendTimeoutMs('schedule-versions/12/entries')).toBe(BACKEND_REQUEST_TIMEOUT_MS);
  });

  it('allows solver-backed generation much longer, without removing the bound', () => {
    expect(Number.isFinite(BACKEND_GENERATION_TIMEOUT_MS)).toBe(true);
    expect(BACKEND_GENERATION_TIMEOUT_MS).toBeGreaterThan(BACKEND_REQUEST_TIMEOUT_MS);
    expect(backendTimeoutMs('scheduling/generate')).toBe(BACKEND_GENERATION_TIMEOUT_MS);
    expect(backendTimeoutMs('/scheduling/generate-college')).toBe(
      BACKEND_GENERATION_TIMEOUT_MS,
    );
    expect(backendTimeoutMs('schedules/generate-department-draft')).toBe(
      BACKEND_GENERATION_TIMEOUT_MS,
    );
    expect(backendTimeoutMs('schedules/generate-college-draft?x=1')).toBe(
      BACKEND_GENERATION_TIMEOUT_MS,
    );
  });

  it('does not treat an ordinary schedules call as generation', () => {
    expect(backendTimeoutMs('schedules')).toBe(BACKEND_REQUEST_TIMEOUT_MS);
    expect(backendTimeoutMs('schedules/12/versions')).toBe(BACKEND_REQUEST_TIMEOUT_MS);
  });
});
