import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';

const health = new Hono<AppEnv>();

health.get('/', async (c) => {
  const checks: Record<string, boolean> = {};

  // Check D1
  try {
    await c.env.DB_CORE.prepare('SELECT 1').first();
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check KV
  try {
    await c.env.KV_CONFIG.get('__health_check__');
    checks.cache = true;
  } catch {
    checks.cache = false;
  }

  const allHealthy = Object.values(checks).every(Boolean);

  return c.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      environment: c.env.ENV,
    },
    allHealthy ? 200 : 503
  );
});

health.get('/ready', (c) => {
  return c.json({ ready: true });
});

health.get('/live', (c) => {
  return c.json({ live: true });
});

export { health };
