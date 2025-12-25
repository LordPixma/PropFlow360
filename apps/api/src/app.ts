import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './lib/context';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/error-handler';
import { databaseMiddleware } from './middleware/database';
import { routes } from './routes';

export function createApp() {
  const app = new Hono<AppEnv>();

  // Global middleware
  app.use('*', requestId());
  app.use('*', logger());
  app.use('*', secureHeaders());
  app.use('*', corsMiddleware);
  app.use('*', errorHandler);
  app.use('*', databaseMiddleware);

  // Root route
  app.get('/', (c) => {
    return c.json({
      name: 'PropFlow360 API',
      version: '0.1.0',
      environment: c.env.ENV,
    });
  });

  // API routes
  app.route('/', routes);

  // 404 handler
  app.notFound((c) => {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found',
        },
      },
      404
    );
  });

  return app;
}
