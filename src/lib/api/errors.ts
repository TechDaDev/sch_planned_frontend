/**
 * Normalized frontend API error model.
 *
 * The UI depends on this shape, not on a specific DRF error payload, and no raw
 * backend/HTML/stack content is ever surfaced to end users.
 */

export interface ApiError {
  status: number;
  code?: string;
  detail: string;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
}

const MAX_MESSAGE_LENGTH = 300;

const STATUS_MESSAGES: Record<number, string> = {
  400: 'The request could not be processed.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  405: 'This action is not supported.',
  409: 'The request conflicts with the current state.',
  413: 'The uploaded file is too large.',
  415: 'The uploaded file type is not supported.',
  422: 'The submitted data is invalid.',
  429: 'Too many requests. Please try again later.',
  500: 'The server encountered an error.',
  502: 'The server is temporarily unavailable.',
  503: 'The service is temporarily unavailable.',
  504: 'The server took too long to respond.',
};

export function defaultMessageForStatus(status: number): string {
  if (status === 0) {
    return 'The server could not be reached. Check your connection and try again.';
  }
  return STATUS_MESSAGES[status] ?? `The request failed (HTTP ${status}).`;
}

/** Drop anything that looks like internal output rather than a user message. */
function sanitizeMessage(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_MESSAGE_LENGTH) {
    return null;
  }
  const lowered = trimmed.toLowerCase();
  const forbidden = [
    '<html',
    '<!doctype',
    '<script',
    'traceback',
    'stack trace',
    'exception at',
    'sqlstate',
    'django.db',
    'select "',
    'bearer ',
    'eyj', // base64url JWT prefix
    'node_modules',
  ];
  if (forbidden.some((token) => lowered.includes(token))) {
    return null;
  }
  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function splitFieldErrors(
  value: Record<string, unknown>,
): Record<string, string[]> | undefined {
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key === 'detail' || key === 'request_id') {
      continue;
    }
    // `code` is the platform error code only when it is a string. The academic
    // API also has a `code` *field* (college, department, course, ...), whose
    // DRF errors arrive as a list and must not be discarded.
    if (key === 'code' && typeof raw === 'string') {
      continue;
    }
    const messages: string[] = [];
    if (typeof raw === 'string') {
      const cleaned = sanitizeMessage(raw);
      if (cleaned) {
        messages.push(cleaned);
      }
    } else if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (typeof entry === 'string') {
          const cleaned = sanitizeMessage(entry);
          if (cleaned) {
            messages.push(cleaned);
          }
        }
      }
    }
    if (messages.length > 0) {
      fieldErrors[key] = messages;
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

function readStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * Convert an untrusted HTTP status + body + optional request id into `ApiError`.
 */
export function normalizeApiError(
  status: number,
  payload: unknown,
  requestId?: string | null,
): ApiError {
  const fallback = defaultMessageForStatus(status);
  const error: ApiError = { status, detail: fallback };

  if (typeof payload === 'string') {
    const cleaned = sanitizeMessage(payload);
    if (cleaned) {
      error.detail = cleaned;
    }
    if (requestId) {
      error.requestId = requestId;
    }
    return error;
  }

  if (!isRecord(payload)) {
    if (requestId) {
      error.requestId = requestId;
    }
    return error;
  }

  const code = readStringValue(payload.code);
  if (code) {
    error.code = code;
  }

  const detail = readStringValue(payload.detail);
  const cleanedDetail = detail ? sanitizeMessage(detail) : null;
  if (cleanedDetail) {
    error.detail = cleanedDetail;
  }

  const fieldErrors = splitFieldErrors(payload);
  if (fieldErrors) {
    error.fieldErrors = fieldErrors;
    if (!cleanedDetail) {
      const firstField = Object.keys(fieldErrors)[0];
      const firstMessage = firstField ? fieldErrors[firstField]?.[0] : undefined;
      if (firstMessage) {
        error.detail = firstMessage;
      }
    }
  }

  const payloadRequestId =
    readStringValue(payload.request_id) ?? readStringValue(payload.requestId);
  const resolvedRequestId = requestId ?? payloadRequestId;
  if (resolvedRequestId) {
    error.requestId = resolvedRequestId;
  }

  return error;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    isRecord(value) &&
    typeof value.status === 'number' &&
    typeof value.detail === 'string'
  );
}

/**
 * Error thrown by the browser-facing API client. It is an `Error` instance and
 * carries the normalized `ApiError` fields.
 */
export class ApiClientError extends Error implements ApiError {
  readonly status: number;
  readonly detail: string;
  readonly code?: string;
  readonly requestId?: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(error: ApiError) {
    super(error.detail);
    this.name = 'ApiClientError';
    this.status = error.status;
    this.detail = error.detail;
    this.code = error.code;
    this.requestId = error.requestId;
    this.fieldErrors = error.fieldErrors;
  }

  toApiError(): ApiError {
    const result: ApiError = { status: this.status, detail: this.detail };
    if (this.code !== undefined) {
      result.code = this.code;
    }
    if (this.requestId !== undefined) {
      result.requestId = this.requestId;
    }
    if (this.fieldErrors !== undefined) {
      result.fieldErrors = this.fieldErrors;
    }
    return result;
  }
}

/** Safe message for any thrown value (never leaks internals). */
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.detail;
  }
  if (isApiError(error)) {
    return error.detail;
  }
  return 'Something went wrong. Please try again.';
}
