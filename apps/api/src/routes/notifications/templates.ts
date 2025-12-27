/**
 * Notification Template Management Routes
 */

import { Hono } from 'hono';
import { notificationTemplates } from '@propflow360/db';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../../lib/context';
import { generateId } from '../../lib/id';

const app = new Hono<AppEnv>();

// List notification templates
app.get('/', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = c.get('db');

  const event = c.req.query('event');
  const isActive = c.req.query('is_active');

  const conditions = [eq(notificationTemplates.tenantId, tenantId)];

  if (event) {
    conditions.push(eq(notificationTemplates.event, event));
  }

  if (isActive !== undefined) {
    conditions.push(eq(notificationTemplates.isActive, isActive === 'true'));
  }

  const templates = await db
    .select()
    .from(notificationTemplates)
    .where(and(...conditions));

  return c.json({ templates });
});

// Get single template
app.get('/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const id = c.req.param('id');
  const db = c.get('db');

  const [template] = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.id, id),
        eq(notificationTemplates.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  return c.json({ template });
});

// Create notification template
app.post('/', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = c.get('db');

  const body = await c.req.json();
  const {
    name,
    description,
    type,
    event,
    emailSubject,
    emailBody,
    emailTemplate,
    smsBody,
    isActive = true,
    isDefault = false,
  } = body;

  if (!name || !type || !event) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (type === 'email' && !emailSubject && !emailBody) {
    return c.json({ error: 'Email template requires subject or body' }, 400);
  }

  if (type === 'sms' && !smsBody) {
    return c.json({ error: 'SMS template requires body' }, 400);
  }

  const templateId = generateId('ntpl');
  const now = new Date().toISOString();

  await db.insert(notificationTemplates).values({
    id: templateId,
    tenantId,
    name,
    description: description || null,
    type,
    event,
    emailSubject: emailSubject || null,
    emailBody: emailBody || null,
    emailTemplate: emailTemplate || null,
    smsBody: smsBody || null,
    isActive: Boolean(isActive),
    isDefault: Boolean(isDefault),
    createdAt: now,
    updatedAt: now,
  });

  const [template] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.id, templateId))
    .limit(1);

  return c.json({ template }, 201);
});

// Update notification template
app.patch('/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const id = c.req.param('id');
  const db = c.get('db');

  const [existing] = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.id, id),
        eq(notificationTemplates.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const body = await c.req.json();
  const {
    name,
    description,
    type,
    event,
    emailSubject,
    emailBody,
    emailTemplate,
    smsBody,
    isActive,
    isDefault,
  } = body;

  const now = new Date().toISOString();

  await db
    .update(notificationTemplates)
    .set({
      name: name !== undefined ? name : existing.name,
      description: description !== undefined ? description : existing.description,
      type: type !== undefined ? type : existing.type,
      event: event !== undefined ? event : existing.event,
      emailSubject: emailSubject !== undefined ? emailSubject : existing.emailSubject,
      emailBody: emailBody !== undefined ? emailBody : existing.emailBody,
      emailTemplate: emailTemplate !== undefined ? emailTemplate : existing.emailTemplate,
      smsBody: smsBody !== undefined ? smsBody : existing.smsBody,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
      isDefault: isDefault !== undefined ? Boolean(isDefault) : existing.isDefault,
      updatedAt: now,
    })
    .where(eq(notificationTemplates.id, id));

  const [template] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.id, id))
    .limit(1);

  return c.json({ template });
});

// Delete notification template
app.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const id = c.req.param('id');
  const db = c.get('db');

  const [existing] = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.id, id),
        eq(notificationTemplates.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Template not found' }, 404);
  }

  await db.delete(notificationTemplates).where(eq(notificationTemplates.id, id));

  return c.json({ success: true });
});

// Toggle template active status
app.post('/:id/toggle', async (c) => {
  const tenantId = c.get('tenantId')!;
  const id = c.req.param('id');
  const db = c.get('db');

  const [existing] = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.id, id),
        eq(notificationTemplates.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const now = new Date().toISOString();
  const newStatus = !existing.isActive;

  await db
    .update(notificationTemplates)
    .set({
      isActive: newStatus,
      updatedAt: now,
    })
    .where(eq(notificationTemplates.id, id));

  const [template] = await db
    .select()
    .from(notificationTemplates)
    .where(eq(notificationTemplates.id, id))
    .limit(1);

  return c.json({ template });
});

export default app;
