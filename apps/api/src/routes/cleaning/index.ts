import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../../lib/context';
import { requireAuth } from '../../middleware/auth';
import { generateId } from '../../lib/id';
import {
  createCleaningScheduleSchema,
  updateCleaningScheduleSchema,
  completeCleaningSchema,
  listCleaningSchedulesSchema,
  createChecklistTemplateSchema,
  updateChecklistTemplateSchema,
  listChecklistTemplatesSchema,
} from '@propflow360/validators';
import {
  cleaningSchedules,
  cleaningChecklists,
  properties,
  units,
  vendors,
  bookings,
} from '@propflow360/db';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';

export const cleaningRouter = new Hono<AppEnv>();

// Apply auth middleware
cleaningRouter.use('*', requireAuth);

// ============================================================
// Cleaning Schedule Routes
// ============================================================

// List schedules
cleaningRouter.get('/schedules', zValidator('query', listCleaningSchedulesSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const query = c.req.valid('query');

  const conditions = [eq(cleaningSchedules.tenantId, tenantId)];

  if (query.propertyId) conditions.push(eq(cleaningSchedules.propertyId, query.propertyId));
  if (query.unitId) conditions.push(eq(cleaningSchedules.unitId, query.unitId));
  if (query.type) conditions.push(eq(cleaningSchedules.type, query.type));
  if (query.status) conditions.push(eq(cleaningSchedules.status, query.status));
  if (query.assignedToVendorId) conditions.push(eq(cleaningSchedules.assignedToVendorId, query.assignedToVendorId));
  if (query.startDate) conditions.push(gte(cleaningSchedules.scheduledDate, query.startDate));
  if (query.endDate) conditions.push(lte(cleaningSchedules.scheduledDate, query.endDate));

  const offset = (query.page - 1) * query.pageSize;

  const [scheduleResults, countResult] = await Promise.all([
    db
      .select({
        id: cleaningSchedules.id,
        propertyId: cleaningSchedules.propertyId,
        propertyName: properties.name,
        unitId: cleaningSchedules.unitId,
        unitName: units.name,
        type: cleaningSchedules.type,
        bookingId: cleaningSchedules.bookingId,
        scheduledDate: cleaningSchedules.scheduledDate,
        scheduledTime: cleaningSchedules.scheduledTime,
        estimatedDuration: cleaningSchedules.estimatedDuration,
        assignedToVendorId: cleaningSchedules.assignedToVendorId,
        vendorName: vendors.name,
        status: cleaningSchedules.status,
        completedAt: cleaningSchedules.completedAt,
        cost: cleaningSchedules.cost,
        currency: cleaningSchedules.currency,
        createdAt: cleaningSchedules.createdAt,
      })
      .from(cleaningSchedules)
      .leftJoin(properties, eq(cleaningSchedules.propertyId, properties.id))
      .leftJoin(units, eq(cleaningSchedules.unitId, units.id))
      .leftJoin(vendors, eq(cleaningSchedules.assignedToVendorId, vendors.id))
      .where(and(...conditions))
      .orderBy(desc(cleaningSchedules.scheduledDate), desc(cleaningSchedules.createdAt))
      .limit(query.pageSize)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)` })
      .from(cleaningSchedules)
      .where(and(...conditions)),
  ]);

  return c.json({
    schedules: scheduleResults,
    total: countResult[0]?.count || 0,
    page: query.page,
    pageSize: query.pageSize,
  });
});

// Get schedule by ID
cleaningRouter.get('/schedules/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const scheduleId = c.req.param('id');

  const [schedule] = await db
    .select({
      schedule: cleaningSchedules,
      propertyName: properties.name,
      unitName: units.name,
      vendorName: vendors.name,
    })
    .from(cleaningSchedules)
    .leftJoin(properties, eq(cleaningSchedules.propertyId, properties.id))
    .leftJoin(units, eq(cleaningSchedules.unitId, units.id))
    .leftJoin(vendors, eq(cleaningSchedules.assignedToVendorId, vendors.id))
    .where(and(eq(cleaningSchedules.id, scheduleId), eq(cleaningSchedules.tenantId, tenantId)));

  if (!schedule) {
    return c.json({ error: 'Schedule not found' }, 404);
  }

  return c.json({
    schedule: {
      ...schedule.schedule,
      propertyName: schedule.propertyName,
      unitName: schedule.unitName,
      vendorName: schedule.vendorName,
    },
  });
});

// Create schedule
cleaningRouter.post('/schedules', zValidator('json', createCleaningScheduleSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  // Verify unit exists
  const [unit] = await db
    .select()
    .from(units)
    .where(and(eq(units.id, data.unitId), eq(units.tenantId, tenantId)));

  if (!unit) {
    return c.json({ error: 'Unit not found' }, 400);
  }

  // If checklist template specified, load it
  let checklistItems = null;
  if (data.checklistTemplateId) {
    const [template] = await db
      .select()
      .from(cleaningChecklists)
      .where(and(eq(cleaningChecklists.id, data.checklistTemplateId), eq(cleaningChecklists.tenantId, tenantId)));

    if (template && template.items) {
      // Convert template items to checklist items with completion status
      checklistItems = (template.items as any[]).map((item: any) => ({
        id: item.id,
        area: item.area,
        task: item.task,
        completed: false,
      }));
    }
  }

  const scheduleId = generateId('cln');

  await db.insert(cleaningSchedules).values({
    id: scheduleId,
    tenantId,
    propertyId: data.propertyId,
    unitId: data.unitId,
    type: data.type,
    bookingId: data.bookingId || null,
    checkoutDate: data.checkoutDate || null,
    nextCheckinDate: data.nextCheckinDate || null,
    scheduledDate: data.scheduledDate,
    scheduledTime: data.scheduledTime || null,
    estimatedDuration: data.estimatedDuration || null,
    assignedToVendorId: data.assignedToVendorId || null,
    assignedAt: data.assignedToVendorId ? now : null,
    status: data.assignedToVendorId ? 'assigned' : 'scheduled',
    checklistTemplateId: data.checklistTemplateId || null,
    checklistItems,
    notes: data.notes || null,
    internalNotes: data.internalNotes || null,
    createdAt: now,
    updatedAt: now,
  });

  const [newSchedule] = await db.select().from(cleaningSchedules).where(eq(cleaningSchedules.id, scheduleId));

  return c.json({ schedule: newSchedule }, 201);
});

// Update schedule
cleaningRouter.patch('/schedules/:id', zValidator('json', updateCleaningScheduleSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const scheduleId = c.req.param('id');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  const [schedule] = await db
    .select()
    .from(cleaningSchedules)
    .where(and(eq(cleaningSchedules.id, scheduleId), eq(cleaningSchedules.tenantId, tenantId)));

  if (!schedule) {
    return c.json({ error: 'Schedule not found' }, 404);
  }

  const updates: Partial<typeof schedule> = { updatedAt: now };

  if (data.scheduledDate !== undefined) updates.scheduledDate = data.scheduledDate;
  if (data.scheduledTime !== undefined) updates.scheduledTime = data.scheduledTime;
  if (data.estimatedDuration !== undefined) updates.estimatedDuration = data.estimatedDuration;
  if (data.assignedToVendorId !== undefined) {
    updates.assignedToVendorId = data.assignedToVendorId;
    if (data.assignedToVendorId && !schedule.assignedAt) {
      updates.assignedAt = now;
      updates.status = 'assigned';
    }
  }
  if (data.status !== undefined) {
    updates.status = data.status;
    if (data.status === 'in_progress' && !schedule.startedAt) {
      updates.startedAt = now;
    }
    if (data.status === 'completed' && !schedule.completedAt) {
      updates.completedAt = now;
    }
  }
  if (data.checklistItems !== undefined) updates.checklistItems = data.checklistItems;
  if (data.issuesFound !== undefined) updates.issuesFound = data.issuesFound;
  if (data.cost !== undefined) updates.cost = data.cost;
  if (data.beforeImageUrls !== undefined) updates.beforeImageUrls = data.beforeImageUrls;
  if (data.afterImageUrls !== undefined) updates.afterImageUrls = data.afterImageUrls;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.internalNotes !== undefined) updates.internalNotes = data.internalNotes;

  await db.update(cleaningSchedules).set(updates).where(eq(cleaningSchedules.id, scheduleId));

  const [updated] = await db.select().from(cleaningSchedules).where(eq(cleaningSchedules.id, scheduleId));

  return c.json({ schedule: updated });
});

// Complete cleaning
cleaningRouter.post('/schedules/:id/complete', zValidator('json', completeCleaningSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const db = c.get('db');
  const scheduleId = c.req.param('id');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  const [schedule] = await db
    .select()
    .from(cleaningSchedules)
    .where(and(eq(cleaningSchedules.id, scheduleId), eq(cleaningSchedules.tenantId, tenantId)));

  if (!schedule) {
    return c.json({ error: 'Schedule not found' }, 404);
  }

  await db
    .update(cleaningSchedules)
    .set({
      status: 'completed',
      completedAt: now,
      completedByVendorId: schedule.assignedToVendorId,
      checklistItems: data.checklistItems,
      issuesFound: data.issuesFound || null,
      maintenanceTicketsCreated: data.maintenanceTicketsCreated || null,
      cost: data.cost || null,
      afterImageUrls: data.afterImageUrls || null,
      notes: data.notes || null,
      updatedAt: now,
    })
    .where(eq(cleaningSchedules.id, scheduleId));

  return c.json({ success: true });
});

// Cancel schedule
cleaningRouter.post('/schedules/:id/cancel', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const scheduleId = c.req.param('id');
  const now = new Date().toISOString();

  const [schedule] = await db
    .select()
    .from(cleaningSchedules)
    .where(and(eq(cleaningSchedules.id, scheduleId), eq(cleaningSchedules.tenantId, tenantId)));

  if (!schedule) {
    return c.json({ error: 'Schedule not found' }, 404);
  }

  if (schedule.status === 'completed') {
    return c.json({ error: 'Cannot cancel completed cleaning' }, 400);
  }

  await db
    .update(cleaningSchedules)
    .set({ status: 'cancelled', updatedAt: now })
    .where(eq(cleaningSchedules.id, scheduleId));

  return c.json({ success: true });
});

// ============================================================
// Checklist Template Routes
// ============================================================

// List templates
cleaningRouter.get('/checklists', zValidator('query', listChecklistTemplatesSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const query = c.req.valid('query');

  const conditions = [eq(cleaningChecklists.tenantId, tenantId)];

  if (query.type) conditions.push(eq(cleaningChecklists.type, query.type));
  if (query.propertyId) {
    conditions.push(
      sql`(${cleaningChecklists.propertyId} IS NULL OR ${cleaningChecklists.propertyId} = ${query.propertyId})`
    );
  }
  if (query.status) conditions.push(eq(cleaningChecklists.status, query.status));

  const offset = (query.page - 1) * query.pageSize;

  const [templateResults, countResult] = await Promise.all([
    db
      .select()
      .from(cleaningChecklists)
      .where(and(...conditions))
      .orderBy(desc(cleaningChecklists.isDefault), desc(cleaningChecklists.createdAt))
      .limit(query.pageSize)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)` })
      .from(cleaningChecklists)
      .where(and(...conditions)),
  ]);

  return c.json({
    templates: templateResults,
    total: countResult[0]?.count || 0,
    page: query.page,
    pageSize: query.pageSize,
  });
});

// Get template by ID
cleaningRouter.get('/checklists/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const templateId = c.req.param('id');

  const [template] = await db
    .select()
    .from(cleaningChecklists)
    .where(and(eq(cleaningChecklists.id, templateId), eq(cleaningChecklists.tenantId, tenantId)));

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  return c.json({ template });
});

// Create template
cleaningRouter.post('/checklists', zValidator('json', createChecklistTemplateSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  const templateId = generateId('tpl');

  await db.insert(cleaningChecklists).values({
    id: templateId,
    tenantId,
    name: data.name,
    description: data.description || null,
    type: data.type,
    items: data.items,
    propertyId: data.propertyId || null,
    isDefault: data.isDefault,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  const [newTemplate] = await db.select().from(cleaningChecklists).where(eq(cleaningChecklists.id, templateId));

  return c.json({ template: newTemplate }, 201);
});

// Update template
cleaningRouter.patch('/checklists/:id', zValidator('json', updateChecklistTemplateSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const templateId = c.req.param('id');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  const [template] = await db
    .select()
    .from(cleaningChecklists)
    .where(and(eq(cleaningChecklists.id, templateId), eq(cleaningChecklists.tenantId, tenantId)));

  if (!template) {
    return c.json({ error: 'Template not found' }, 404);
  }

  const updates: Partial<typeof template> = { updatedAt: now };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.type !== undefined) updates.type = data.type;
  if (data.items !== undefined) updates.items = data.items;
  if (data.propertyId !== undefined) updates.propertyId = data.propertyId;
  if (data.isDefault !== undefined) updates.isDefault = data.isDefault;
  if (data.status !== undefined) updates.status = data.status;

  await db.update(cleaningChecklists).set(updates).where(eq(cleaningChecklists.id, templateId));

  const [updated] = await db.select().from(cleaningChecklists).where(eq(cleaningChecklists.id, templateId));

  return c.json({ template: updated });
});
