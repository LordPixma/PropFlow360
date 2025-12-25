import { createMiddleware } from 'hono/factory';
import { createDb } from '@propflow360/db';
import type { AppEnv } from '../lib/context';

export const databaseMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const db = createDb(c.env.DB_CORE);
  c.set('db', db);
  await next();
});
