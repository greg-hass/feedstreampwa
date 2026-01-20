export const API_TIMEOUT_MS = 30000;
export const RETRY_DELAYS = [1000, 2000, 5000, 10000];
export const MAX_RETRIES = 4;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export function isRetryableStatus(status: number): boolean {
  return (
    status >= 500 ||
    status === HTTP_STATUS.TOO_MANY_REQUESTS ||
    status === HTTP_STATUS.BAD_GATEWAY ||
    status === HTTP_STATUS.SERVICE_UNAVAILABLE ||
    status === HTTP_STATUS.GATEWAY_TIMEOUT
  );
}
