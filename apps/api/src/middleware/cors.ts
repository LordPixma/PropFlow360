import { cors } from 'hono/cors';
import type { AppEnv } from '../lib/context';

export const corsMiddleware = cors({
  origin: (origin, c) => {
    // Allow requests from our app
    const appUrl = c.env.APP_BASE_URL;
    if (origin === appUrl) {
      return origin;
    }

    // Allow localhost in development
    if (c.env.ENV === 'dev' && origin?.includes('localhost')) {
      return origin;
    }

    // Allow propflow360.com subdomains
    if (origin?.endsWith('.propflow360.com')) {
      return origin;
    }

    return null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  exposeHeaders: ['X-Request-ID'],
  maxAge: 86400,
});
