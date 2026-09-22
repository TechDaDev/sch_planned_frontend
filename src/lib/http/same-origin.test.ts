import { describe, expect, it } from 'vitest';

import {
  MUTATION_METHODS,
  checkSameOriginMutation,
  isMutationMethod,
  sameOriginRejectionResponse,
} from '@/lib/http/same-origin';

const ORIGIN = 'http://localhost:3000';

function request(method: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/backend/schedules`, { method, headers });
}

describe('which methods are guarded', () => {
  it('guards exactly the state-changing methods', () => {
    expect(MUTATION_METHODS).toEqual(['POST', 'PUT', 'PATCH', 'DELETE']);
    for (const method of MUTATION_METHODS) {
      expect(isMutationMethod(method)).toBe(true);
      expect(isMutationMethod(method.toLowerCase())).toBe(true);
    }
  });

  it('never guards reads', () => {
    expect(isMutationMethod('GET')).toBe(false);
    expect(isMutationMethod('HEAD')).toBe(false);
    expect(checkSameOriginMutation(request('GET', { 'sec-fetch-site': 'cross-site' }))).toEqual({
      allowed: true,
    });
    expect(checkSameOriginMutation(request('HEAD', { origin: 'https://evil.example' }))).toEqual({
      allowed: true,
    });
  });
});

describe('cross-site detection', () => {
  it('rejects a cross-site mutation', () => {
    expect(
      checkSameOriginMutation(request('POST', { 'sec-fetch-site': 'cross-site' })),
    ).toEqual({ allowed: false, reason: 'cross_site' });
  });

  it('rejects the value case-insensitively and with surrounding whitespace', () => {
    expect(
      checkSameOriginMutation(request('DELETE', { 'sec-fetch-site': ' Cross-Site ' })),
    ).toEqual({ allowed: false, reason: 'cross_site' });
  });

  it('allows same-origin and same-site fetch metadata', () => {
    expect(checkSameOriginMutation(request('POST', { 'sec-fetch-site': 'same-origin' }))).toEqual({
      allowed: true,
    });
    expect(checkSameOriginMutation(request('POST', { 'sec-fetch-site': 'same-site' }))).toEqual({
      allowed: true,
    });
    expect(checkSameOriginMutation(request('PATCH', { 'sec-fetch-site': 'none' }))).toEqual({
      allowed: true,
    });
  });
});

describe('origin verification', () => {
  it('accepts an Origin that matches the delivered origin', () => {
    expect(checkSameOriginMutation(request('POST', { origin: ORIGIN }))).toEqual({
      allowed: true,
    });
  });

  it('rejects a foreign Origin', () => {
    expect(checkSameOriginMutation(request('POST', { origin: 'https://evil.example' }))).toEqual({
      allowed: false,
      reason: 'origin_mismatch',
    });
  });

  it('rejects a mismatched port', () => {
    expect(
      checkSameOriginMutation(request('PUT', { origin: 'http://localhost:3001' })),
    ).toEqual({ allowed: false, reason: 'origin_mismatch' });
  });

  it('tolerates a scheme difference, which TLS termination introduces', () => {
    // The server may see http while the browser used https; the host is what decides.
    expect(
      checkSameOriginMutation(request('PUT', { origin: 'https://localhost:3000' })),
    ).toEqual({ allowed: true });
  });

  it('accepts an Origin that matches the Host header the client addressed', () => {
    const forwarded = new Request('http://internal-app:3000/api/backend/schedules', {
      method: 'POST',
      headers: { origin: 'http://public.example:3000', host: 'public.example:3000' },
    });

    expect(checkSameOriginMutation(forwarded)).toEqual({ allowed: true });
  });

  it('rejects a non-http Origin scheme', () => {
    expect(checkSameOriginMutation(request('POST', { origin: 'file:///tmp/x' }))).toEqual({
      allowed: false,
      reason: 'origin_mismatch',
    });
  });

  it('rejects the literal `null` origin a sandboxed document sends', () => {
    expect(checkSameOriginMutation(request('POST', { origin: 'null' }))).toEqual({
      allowed: false,
      reason: 'origin_mismatch',
    });
  });

  it('ignores a whitespace-only Origin header', () => {
    expect(checkSameOriginMutation(request('POST', { origin: '   ' }))).toEqual({ allowed: true });
  });
});

describe('non-browser clients', () => {
  it('allows a mutation with neither header', () => {
    expect(checkSameOriginMutation(request('POST'))).toEqual({ allowed: true });
  });

  it('does not trust forwarding headers as proof of origin', () => {
    expect(
      checkSameOriginMutation(
        request('POST', {
          origin: 'https://evil.example',
          'x-forwarded-host': 'localhost:3000',
          'x-forwarded-proto': 'http',
          host: 'localhost:3000',
        }),
      ),
    ).toEqual({ allowed: false, reason: 'origin_mismatch' });
  });
});

describe('rejection response', () => {
  it('returns null when the request may proceed', () => {
    expect(sameOriginRejectionResponse(request('GET'))).toBeNull();
    expect(sameOriginRejectionResponse(request('POST', { origin: ORIGIN }))).toBeNull();
  });

  it('answers 403 with a fixed body and no echoed origin', async () => {
    const response = sameOriginRejectionResponse(
      request('POST', { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }),
    );

    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
    const body = (await response!.json()) as Record<string, unknown>;
    expect(body).toEqual({
      code: 'cross_site_request_rejected',
      detail: 'The request was rejected because it did not originate from this application.',
    });
    expect(response!.headers.get('cache-control')).toContain('no-store');
  });
});
