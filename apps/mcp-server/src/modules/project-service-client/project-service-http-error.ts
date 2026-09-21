import { AxiosError } from 'axios';

export type ProjectServiceErrorCode =
  | 'AUTH_EXPIRED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'TRANSIENT_ERROR';

export interface ProjectServiceHttpError {
  code: ProjectServiceErrorCode;
  status: number;
  message: string;
  retryable: boolean;
}

/** project-service's AllExceptionFilter envelope: { statusCode, errorCode, message, ... }. */
interface ProjectServiceErrorBody {
  message?: string;
  errorCode?: string;
}

export function toProjectServiceHttpError(error: unknown): ProjectServiceHttpError {
  if (!isAxiosError(error)) {
    return {
      code: 'TRANSIENT_ERROR',
      status: 0,
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }

  if (!error.response) {
    // Network error, timeout, or connection refused — no HTTP status at all.
    return {
      code: 'TRANSIENT_ERROR',
      status: 0,
      message: error.message,
      retryable: true,
    };
  }

  const { status, data } = error.response;
  const body = (data ?? {}) as ProjectServiceErrorBody;
  // Whitelist only caller-safe fields — never forward the full response body,
  // which may carry internal details project-service didn't intend for the
  // MCP client (e.g. `details` in non-production environments).
  const message = body.message || `project-service request failed with status ${status}`;

  if (status === 401 || status === 403) {
    return { code: 'AUTH_EXPIRED', status, message, retryable: false };
  }
  if (status === 400 || status === 422) {
    return { code: 'VALIDATION_ERROR', status, message, retryable: false };
  }
  if (status === 404) {
    return { code: 'NOT_FOUND', status, message, retryable: false };
  }
  return { code: 'TRANSIENT_ERROR', status, message, retryable: status >= 500 };
}

function isAxiosError(error: unknown): error is AxiosError {
  return (
    Boolean(error) &&
    typeof error === 'object' &&
    (error as AxiosError).isAxiosError === true
  );
}
