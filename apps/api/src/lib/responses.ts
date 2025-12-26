import type { Context } from 'hono';
import type { ApiResponse, ApiMeta } from '@propflow360/types';

export function success<T>(c: Context, data: T, meta?: ApiMeta, status: number = 200) {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta,
  };
  return c.json(response, status);
}

export function created<T>(c: Context, data: T) {
  return success(c, data, undefined, 201);
}

export function noContent(c: Context) {
  return c.body(null, 204);
}

export function error(
  c: Context,
  code: string,
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
) {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
  return c.json(response, status);
}

export function badRequest(c: Context, message: string, details?: Record<string, unknown>) {
  return error(c, 'BAD_REQUEST', message, 400, details);
}

export function unauthorized(c: Context, message: string = 'Unauthorized') {
  return error(c, 'UNAUTHORIZED', message, 401);
}

export function forbidden(c: Context, message: string = 'Forbidden') {
  return error(c, 'FORBIDDEN', message, 403);
}

export function notFound(c: Context, resource: string = 'Resource') {
  return error(c, 'NOT_FOUND', `${resource} not found`, 404);
}

export function conflict(c: Context, message: string) {
  return error(c, 'CONFLICT', message, 409);
}

export function internalError(c: Context, message: string = 'Internal server error') {
  return error(c, 'INTERNAL_ERROR', message, 500);
}

export function validationError(c: Context, errors: Record<string, string[]>) {
  return error(c, 'VALIDATION_ERROR', 'Validation failed', 400, { errors });
}

export function paginated<T>(
  c: Context,
  data: T[],
  page: number,
  limit: number,
  total: number
) {
  return success(c, data, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}
