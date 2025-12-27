import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../../lib/context';
import { requireAuth } from '../../middleware/auth';
import { generateId } from '../../lib/id';
import {
  createMaintenanceTicketSchema,
  updateMaintenanceTicketSchema,
  assignMaintenanceTicketSchema,
  addMaintenanceCommentSchema,
  listMaintenanceTicketsSchema,
} from '@propflow360/validators';
import {
  maintenanceTickets,
  maintenanceComments,
  properties,
  units,
  vendors,
  users,
} from '@propflow360/db';
import { eq, and, desc, sql } from 'drizzle-orm';

export const maintenanceRouter = new Hono<AppEnv>();

// Apply auth middleware
maintenanceRouter.use('*', requireAuth);

// ============================================================
// Maintenance Ticket Routes
// ============================================================

// List tickets
maintenanceRouter.get('/', zValidator('query', listMaintenanceTicketsSchema), async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = c.get('db');
  const query = c.req.valid('query');

  const conditions = [eq(maintenanceTickets.tenantId, tenantId)];

  if (query.propertyId) conditions.push(eq(maintenanceTickets.propertyId, query.propertyId));
  if (query.unitId) conditions.push(eq(maintenanceTickets.unitId, query.unitId));
  if (query.status) conditions.push(eq(maintenanceTickets.status, query.status));
  if (query.priority) conditions.push(eq(maintenanceTickets.priority, query.priority));
  if (query.category) conditions.push(eq(maintenanceTickets.category, query.category));
  if (query.assignedToVendorId) conditions.push(eq(maintenanceTickets.assignedToVendorId, query.assignedToVendorId));
  if (query.assignedToUserId) conditions.push(eq(maintenanceTickets.assignedToUserId, query.assignedToUserId));

  const offset = (query.page - 1) * query.pageSize;

  const [ticketResults, countResult] = await Promise.all([
    db
      .select({
        id: maintenanceTickets.id,
        ticketNumber: maintenanceTickets.ticketNumber,
        propertyId: maintenanceTickets.propertyId,
        propertyName: properties.name,
        unitId: maintenanceTickets.unitId,
        unitName: units.name,
        title: maintenanceTickets.title,
        description: maintenanceTickets.description,
        category: maintenanceTickets.category,
        priority: maintenanceTickets.priority,
        status: maintenanceTickets.status,
        assignedToVendorId: maintenanceTickets.assignedToVendorId,
        vendorName: vendors.name,
        scheduledDate: maintenanceTickets.scheduledDate,
        dueDate: maintenanceTickets.dueDate,
        estimatedCost: maintenanceTickets.estimatedCost,
        actualCost: maintenanceTickets.actualCost,
        currency: maintenanceTickets.currency,
        createdAt: maintenanceTickets.createdAt,
      })
      .from(maintenanceTickets)
      .leftJoin(properties, eq(maintenanceTickets.propertyId, properties.id))
      .leftJoin(units, eq(maintenanceTickets.unitId, units.id))
      .leftJoin(vendors, eq(maintenanceTickets.assignedToVendorId, vendors.id))
      .where(and(...conditions))
      .orderBy(desc(maintenanceTickets.createdAt))
      .limit(query.pageSize)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)` })
      .from(maintenanceTickets)
      .where(and(...conditions)),
  ]);

  return c.json({
    tickets: ticketResults,
    total: countResult[0]?.count || 0,
    page: query.page,
    pageSize: query.pageSize,
  });
});

// Get ticket by ID
maintenanceRouter.get('/:id', async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = c.get('db');
  const ticketId = c.req.param('id');

  const [ticket] = await db
    .select({
      ticket: maintenanceTickets,
      propertyName: properties.name,
      unitName: units.name,
      vendorName: vendors.name,
      assignedUserName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
    })
    .from(maintenanceTickets)
    .leftJoin(properties, eq(maintenanceTickets.propertyId, properties.id))
    .leftJoin(units, eq(maintenanceTickets.unitId, units.id))
    .leftJoin(vendors, eq(maintenanceTickets.assignedToVendorId, vendors.id))
    .leftJoin(users, eq(maintenanceTickets.assignedToUserId, users.id))
    .where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.tenantId, tenantId)));

  if (!ticket) {
    return c.json({ error: 'Ticket not found' }, 404);
  }

  // Get comments
  const comments = await db
    .select({
      id: maintenanceComments.id,
      comment: maintenanceComments.comment,
      isInternal: maintenanceComments.isInternal,
      statusChange: maintenanceComments.statusChange,
      imageUrls: maintenanceComments.imageUrls,
      createdAt: maintenanceComments.createdAt,
      userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      vendorName: vendors.name,
    })
    .from(maintenanceComments)
    .leftJoin(users, eq(maintenanceComments.userId, users.id))
    .leftJoin(vendors, eq(maintenanceComments.vendorId, vendors.id))
    .where(eq(maintenanceComments.ticketId, ticketId))
    .orderBy(maintenanceComments.createdAt);

  return c.json({
    ticket: {
      ...ticket.ticket,
      propertyName: ticket.propertyName,
      unitName: ticket.unitName,
      vendorName: ticket.vendorName,
      assignedUserName: ticket.assignedUserName,
      comments,
    },
  });
});

// Create ticket
maintenanceRouter.post('/', zValidator('json', createMaintenanceTicketSchema), async (c) => {
  const tenantId = c.get('tenantId')!;
  const userId = c.get('userId');
  const db = c.get('db');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  // Verify property exists
  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, data.propertyId), eq(properties.tenantId, tenantId)));

  if (!property) {
    return c.json({ error: 'Property not found' }, 400);
  }

  // Generate ticket number
  const [lastTicket] = await db
    .select({ ticketNumber: maintenanceTickets.ticketNumber })
    .from(maintenanceTickets)
    .where(eq(maintenanceTickets.tenantId, tenantId))
    .orderBy(desc(maintenanceTickets.createdAt))
    .limit(1);

  const lastNumber = lastTicket?.ticketNumber
    ? parseInt(lastTicket.ticketNumber.replace('MT-', ''), 10)
    : 0;
  const ticketNumber = `MT-${String(lastNumber + 1).padStart(6, '0')}`;

  const ticketId = generateId('mtn');

  await db.insert(maintenanceTickets).values({
    id: ticketId,
    tenantId,
    ticketNumber,
    propertyId: data.propertyId,
    unitId: data.unitId || null,
    title: data.title,
    description: data.description,
    category: data.category,
    priority: data.priority,
    status: 'open',
    reportedByUserId: userId,
    reportedByGuest: data.reportedByGuest || null,
    reportedByEmail: data.reportedByEmail || null,
    scheduledDate: data.scheduledDate || null,
    dueDate: data.dueDate || null,
    estimatedCost: data.estimatedCost || null,
    currency: 'GBP',
    imageUrls: data.imageUrls || null,
    internalNotes: data.internalNotes || null,
    createdAt: now,
    updatedAt: now,
  });

  const [newTicket] = await db.select().from(maintenanceTickets).where(eq(maintenanceTickets.id, ticketId));

  return c.json({ ticket: newTicket }, 201);
});

// Update ticket
maintenanceRouter.patch('/:id', zValidator('json', updateMaintenanceTicketSchema), async (c) => {
  const tenantId = c.get('tenantId')!;
  const db = c.get('db');
  const ticketId = c.req.param('id');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  const [ticket] = await db
    .select()
    .from(maintenanceTickets)
    .where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.tenantId, tenantId)));

  if (!ticket) {
    return c.json({ error: 'Ticket not found' }, 404);
  }

  const updates: Partial<typeof ticket> = { updatedAt: now };

  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.category !== undefined) updates.category = data.category;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.status !== undefined) {
    updates.status = data.status;
    if (data.status === 'resolved' || data.status === 'closed') {
      updates.completedAt = now;
    }
  }
  if (data.scheduledDate !== undefined) updates.scheduledDate = data.scheduledDate;
  if (data.dueDate !== undefined) updates.dueDate = data.dueDate;
  if (data.estimatedCost !== undefined) updates.estimatedCost = data.estimatedCost;
  if (data.actualCost !== undefined) updates.actualCost = data.actualCost;
  if (data.imageUrls !== undefined) updates.imageUrls = data.imageUrls;
  if (data.internalNotes !== undefined) updates.internalNotes = data.internalNotes;

  await db.update(maintenanceTickets).set(updates).where(eq(maintenanceTickets.id, ticketId));

  const [updated] = await db.select().from(maintenanceTickets).where(eq(maintenanceTickets.id, ticketId));

  return c.json({ ticket: updated });
});

// Assign ticket
maintenanceRouter.post('/:id/assign', zValidator('json', assignMaintenanceTicketSchema), async (c) => {
  const tenantId = c.get('tenantId')!;
  const userId = c.get('userId');
  const db = c.get('db');
  const ticketId = c.req.param('id');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  const [ticket] = await db
    .select()
    .from(maintenanceTickets)
    .where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.tenantId, tenantId)));

  if (!ticket) {
    return c.json({ error: 'Ticket not found' }, 404);
  }

  await db
    .update(maintenanceTickets)
    .set({
      assignedToVendorId: data.assignedToVendorId || null,
      assignedToUserId: data.assignedToUserId || null,
      assignedAt: now,
      status: 'assigned',
      updatedAt: now,
    })
    .where(eq(maintenanceTickets.id, ticketId));

  // Add comment
  const commentId = generateId('mtc');
  await db.insert(maintenanceComments).values({
    id: commentId,
    tenantId,
    ticketId,
    userId,
    comment: `Ticket assigned to ${data.assignedToVendorId ? 'vendor' : 'user'}`,
    isInternal: false,
    statusChange: `${ticket.status} → assigned`,
    createdAt: now,
  });

  return c.json({ success: true });
});

// Add comment
maintenanceRouter.post('/:id/comments', zValidator('json', addMaintenanceCommentSchema), async (c) => {
  const tenantId = c.get('tenantId')!;
  const userId = c.get('userId');
  const db = c.get('db');
  const ticketId = c.req.param('id');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  const [ticket] = await db
    .select()
    .from(maintenanceTickets)
    .where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.tenantId, tenantId)));

  if (!ticket) {
    return c.json({ error: 'Ticket not found' }, 404);
  }

  const commentId = generateId('mtc');

  await db.insert(maintenanceComments).values({
    id: commentId,
    tenantId,
    ticketId,
    userId,
    comment: data.comment,
    isInternal: data.isInternal,
    statusChange: data.statusChange || null,
    imageUrls: data.imageUrls || null,
    createdAt: now,
  });

  const [newComment] = await db.select().from(maintenanceComments).where(eq(maintenanceComments.id, commentId));

  return c.json({ comment: newComment }, 201);
});

// Close ticket
maintenanceRouter.post('/:id/close', async (c) => {
  const tenantId = c.get('tenantId')!;
  const userId = c.get('userId');
  const db = c.get('db');
  const ticketId = c.req.param('id');
  const now = new Date().toISOString();

  const [ticket] = await db
    .select()
    .from(maintenanceTickets)
    .where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.tenantId, tenantId)));

  if (!ticket) {
    return c.json({ error: 'Ticket not found' }, 404);
  }

  await db
    .update(maintenanceTickets)
    .set({
      status: 'closed',
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(maintenanceTickets.id, ticketId));

  // Add comment
  const commentId = generateId('mtc');
  await db.insert(maintenanceComments).values({
    id: commentId,
    tenantId,
    ticketId,
    userId,
    comment: 'Ticket closed',
    isInternal: false,
    statusChange: `${ticket.status} → closed`,
    createdAt: now,
  });

  return c.json({ success: true });
});
