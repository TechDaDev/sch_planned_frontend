import { describe, expect, it } from 'vitest';

import {
  ApiClientError,
  defaultMessageForStatus,
  getApiErrorMessage,
  isApiError,
  normalizeApiError,
} from '@/lib/api/errors';

describe('normalizeApiError', () => {
  it('uses the DRF detail message', () => {
    const error = normalizeApiError(400, { detail: 'Invalid input.' });
    expect(error).toEqual({ status: 400, detail: 'Invalid input.' });
  });

  it('preserves DRF field errors', () => {
    const error = normalizeApiError(400, {
      username: ['This field is required.'],
      password: ['Too short.'],
    });
    expect(error.fieldErrors).toEqual({
      username: ['This field is required.'],
      password: ['Too short.'],
    });
    expect(error.detail).toBe('This field is required.');
  });

  it('keeps both detail and field errors when both exist', () => {
    const error = normalizeApiError(400, {
      detail: 'Validation failed.',
      code: 'invalid',
      start_year: ['Must be lower than end year.'],
    });
    expect(error.detail).toBe('Validation failed.');
    expect(error.code).toBe('invalid');
    expect(error.fieldErrors).toEqual({ start_year: ['Must be lower than end year.'] });
  });

  it('falls back to a safe status message for unknown payloads', () => {
    expect(normalizeApiError(403, null).detail).toBe(
      'You do not have permission to perform this action.',
    );
    expect(normalizeApiError(418, {}).detail).toBe('The request failed (HTTP 418).');
    expect(defaultMessageForStatus(0)).toContain('could not be reached');
  });

  it('never surfaces HTML, stack traces or token material', () => {
    const html = normalizeApiError(500, '<html><body>Traceback Exception at 0x1</body></html>');
    expect(html.detail).toBe('The server encountered an error.');
    expect(html.detail).not.toContain('<html');

    const token = normalizeApiError(401, { detail: 'Bearer eyJhbGciOiJIUzI1NiJ9.abc.def' });
    expect(token.detail).toBe('Your session has expired. Please sign in again.');

    const long = normalizeApiError(400, 'x'.repeat(500));
    expect(long.detail).toBe('The request could not be processed.');
  });

  it('reads a request id from the payload or the header value', () => {
    expect(normalizeApiError(500, { request_id: 'req-1' }).requestId).toBe('req-1');
    expect(normalizeApiError(500, {}, 'req-2').requestId).toBe('req-2');
  });

  it('recognizes the normalized shape', () => {
    expect(isApiError(normalizeApiError(400, {}))).toBe(true);
    expect(isApiError(new Error('boom'))).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});

describe('ApiClientError', () => {
  it('is a real Error carrying the normalized fields', () => {
    const error = new ApiClientError({
      status: 404,
      code: 'not_found',
      detail: 'Missing.',
      fieldErrors: { id: ['Unknown.'] },
      requestId: 'req-9',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Missing.');
    expect(error.status).toBe(404);
    expect(error.code).toBe('not_found');
    expect(error.requestId).toBe('req-9');
    expect(error.fieldErrors).toEqual({ id: ['Unknown.'] });
    expect(error.toApiError()).toEqual({
      status: 404,
      code: 'not_found',
      detail: 'Missing.',
      requestId: 'req-9',
      fieldErrors: { id: ['Unknown.'] },
    });
  });

  it('returns a safe message for arbitrary thrown values', () => {
    expect(getApiErrorMessage(new ApiClientError({ status: 500, detail: 'Down.' }))).toBe('Down.');
    expect(getApiErrorMessage(new Error('SELECT * FROM users'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(getApiErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });
});
