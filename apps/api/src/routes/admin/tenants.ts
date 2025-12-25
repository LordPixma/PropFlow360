/**
 * Tenant Management Routes (Admin Only)
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { tenants, tenantSettings, users } from '@propflow360/db';
import { eq, desc } from 'drizzle-orm';
import type { HonoEnv } from '../../types';

const app = new Hono<HonoEnv>();

// List all tenants (super admin only)
app.get('/', async (c) => {
  const db = drizzle(c.env.DB_CORE);

  const allTenants = await db
    .select()
    .from(tenants)
    .orderBy(desc(tenants.createdAt));

  return c.json({ tenants: allTenants });
});

// Get tenant details
app.get('/:id', async (c) => {
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  if (!tenant) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  // Get tenant settings
  const [settings] = await db
    .select()
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, id))
    .limit(1);

  // Get user count
  const userCountResult = await c.env.DB_CORE.prepare(
    'SELECT COUNT(*) as count FROM users WHERE tenant_id = ?'
  ).bind(id).first<{ count: number }>();

  return c.json({
    tenant,
    settings,
    stats: {
      userCount: userCountResult?.count || 0,
    },
  });
});

// Create tenant
app.post('/', async (c) => {
  const db = drizzle(c.env.DB_CORE);
  const body = await c.req.json();

  const { name, slug, plan, status } = body;

  if (!name || !slug) {
    return c.json({ error: 'Name and slug required' }, 400);
  }

  const tenantId = `ten_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  await db.insert(tenants).values({
    id: tenantId,
    name,
    slug,
    plan: plan || 'free',
    status: status || 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Create default settings
  const settingsId = `set_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  await db.insert(tenantSettings).values({
    id: settingsId,
    tenantId,
    timezone: 'UTC',
    currency: 'USD',
    locale: 'en-US',
    createdAt: now,
    updatedAt: now,
  });

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return c.json({ tenant }, 201);
});

// Update tenant
app.patch('/:id', async (c) => {
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [existing] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Tenant not found' }, 404);
  }

  const body = await c.req.json();
  const { name, plan, status } = body;

  const now = new Date().toISOString();

  await db
    .update(tenants)
    .set({
      name: name !== undefined ? name : existing.name,
      plan: plan !== undefined ? plan : existing.plan,
      status: status !== undefined ? status : existing.status,
      updatedAt: now,
    })
    .where(eq(tenants.id, id));

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  return c.json({ tenant });
});

// Suspend tenant
app.post('/:id/suspend', async (c) => {
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const now = new Date().toISOString();

  await db
    .update(tenants)
    .set({ status: 'suspended', updatedAt: now })
    .where(eq(tenants.id, id));

  return c.json({ success: true });
});

// Activate tenant
app.post('/:id/activate', async (c) => {
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const now = new Date().toISOString();

  await db
    .update(tenants)
    .set({ status: 'active', updatedAt: now })
    .where(eq(tenants.id, id));

  return c.json({ success: true });
});

export default app;
