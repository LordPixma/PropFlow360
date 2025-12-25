/**
 * Audit Log Routes
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { auditLogs } from '@propflow360/db';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { HonoEnv } from '../../types';

const app = new Hono<HonoEnv>();

// List audit logs
app.get('/', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const userId = c.req.query('user_id');
  const action = c.req.query('action');
  const resource = c.req.query('resource');
  const resourceId = c.req.query('resource_id');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const conditions = [eq(auditLogs.tenantId, tenantId)];

  if (userId) {
    conditions.push(eq(auditLogs.userId, userId));
  }

  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }

  if (resource) {
    conditions.push(eq(auditLogs.resource, resource));
  }

  if (resourceId) {
    conditions.push(eq(auditLogs.resourceId, resourceId));
  }

  if (startDate) {
    conditions.push(gte(auditLogs.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(auditLogs.createdAt, endDate));
  }

  const logs = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ logs });
});

// Get single audit log
app.get('/:id', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [log] = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.id, id),
        eq(auditLogs.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!log) {
    return c.json({ error: 'Audit log not found' }, 404);
  }

  return c.json({ log });
});

// Helper function to create audit log (exported for use in other routes)
export async function createAuditLog(
  db: any,
  params: {
    tenantId: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    changes?: any;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    metadata?: any;
    severity?: string;
  }
): Promise<void> {
  const logId = `log_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  await db.insert(auditLogs).values({
    id: logId,
    tenantId: params.tenantId,
    userId: params.userId || null,
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId || null,
    changes: params.changes ? JSON.stringify(params.changes) : null,
    ipAddress: params.ipAddress || null,
    userAgent: params.userAgent || null,
    requestId: params.requestId || null,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    severity: params.severity || 'info',
    createdAt: now,
  });
}

export default app;
