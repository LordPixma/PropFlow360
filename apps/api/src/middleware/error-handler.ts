import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../lib/context';
import { internalError } from '../lib/responses';

export const errorHandler = createMiddleware<AppEnv>(async (c, next) => {
  try {
    await next();
  } catch (err) {
    console.error('Unhandled error:', err);

    if (err instanceof Error) {
      // In development, return the actual error message
      if (c.env.ENV === 'dev') {
        return internalError(c, err.message);
      }
    }

    return internalError(c);
  }
});
