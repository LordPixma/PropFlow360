/**
 * Notification Routes
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { notifications } from '@propflow360/db';
import { eq, and, desc } from 'drizzle-orm';
import { queueNotification } from '@propflow360/notifications';
import type { HonoEnv } from '../../types';
import templates from './templates';

const app = new Hono<HonoEnv>();

// Mount template routes
app.route('/templates', templates);

// List notifications (history)
app.get('/', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const status = c.req.query('status');
  const type = c.req.query('type');
  const recipientEmail = c.req.query('recipient_email');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const conditions = [eq(notifications.tenantId, tenantId)];

  if (status) {
    conditions.push(eq(notifications.status, status));
  }

  if (type) {
    conditions.push(eq(notifications.type, type));
  }

  if (recipientEmail) {
    conditions.push(eq(notifications.recipientEmail, recipientEmail));
  }

  const notificationList = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ notifications: notificationList });
});

// Get single notification
app.get('/:id', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [notification] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!notification) {
    return c.json({ error: 'Notification not found' }, 404);
  }

  return c.json({ notification });
});

// Queue a notification
app.post('/', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const body = await c.req.json();
  const {
    type,
    recipientEmail,
    recipientPhone,
    recipientName,
    event,
    variables,
    bookingId,
    leaseId,
    invoiceId,
    maintenanceTicketId,
    cleaningScheduleId,
    scheduledFor,
  } = body;

  if (!type || !event || !variables) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (type === 'email' && !recipientEmail) {
    return c.json({ error: 'Email notifications require recipientEmail' }, 400);
  }

  if (type === 'sms' && !recipientPhone) {
    return c.json({ error: 'SMS notifications require recipientPhone' }, 400);
  }

  const notificationId = await queueNotification(db, {
    tenantId,
    type,
    recipientEmail,
    recipientPhone,
    recipientName,
    event,
    variables,
    bookingId,
    leaseId,
    invoiceId,
    maintenanceTicketId,
    cleaningScheduleId,
    scheduledFor,
  });

  return c.json({ notificationId }, 201);
});

// Cancel a pending notification
app.post('/:id/cancel', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [notification] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!notification) {
    return c.json({ error: 'Notification not found' }, 404);
  }

  if (notification.status !== 'pending') {
    return c.json({ error: 'Can only cancel pending notifications' }, 400);
  }

  const now = new Date().toISOString();

  await db
    .update(notifications)
    .set({
      status: 'failed',
      failureReason: 'Cancelled by user',
      updatedAt: now,
    })
    .where(eq(notifications.id, id));

  return c.json({ success: true });
});

// Retry a failed notification
app.post('/:id/retry', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [notification] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!notification) {
    return c.json({ error: 'Notification not found' }, 404);
  }

  if (notification.status !== 'failed') {
    return c.json({ error: 'Can only retry failed notifications' }, 400);
  }

  const now = new Date().toISOString();

  await db
    .update(notifications)
    .set({
      status: 'pending',
      failureReason: null,
      updatedAt: now,
    })
    .where(eq(notifications.id, id));

  return c.json({ success: true });
});

export default app;
