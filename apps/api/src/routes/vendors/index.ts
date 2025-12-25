import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../../lib/context';
import { requireAuth } from '../../middleware/auth';
import { generateId } from '../../lib/id';
import {
  createVendorSchema,
  updateVendorSchema,
  listVendorsSchema,
} from '@propflow360/validators';
import { vendors } from '@propflow360/db';
import { eq, and, desc, sql } from 'drizzle-orm';

export const vendorsRouter = new Hono<AppEnv>();

// Apply auth middleware
vendorsRouter.use('*', requireAuth);

// List vendors
vendorsRouter.get('/', zValidator('query', listVendorsSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const query = c.req.valid('query');

  const conditions = [eq(vendors.tenantId, tenantId)];

  if (query.type) conditions.push(eq(vendors.type, query.type));
  if (query.status) conditions.push(eq(vendors.status, query.status));

  // Filter by service area (property)
  if (query.propertyId) {
    conditions.push(sql`json_array_length(${vendors.serviceAreas}) = 0 OR ${vendors.serviceAreas} LIKE '%${query.propertyId}%'`);
  }

  const offset = (query.page - 1) * query.pageSize;

  const [vendorResults, countResult] = await Promise.all([
    db
      .select()
      .from(vendors)
      .where(and(...conditions))
      .orderBy(desc(vendors.createdAt))
      .limit(query.pageSize)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)` })
      .from(vendors)
      .where(and(...conditions)),
  ]);

  return c.json({
    vendors: vendorResults,
    total: countResult[0]?.count || 0,
    page: query.page,
    pageSize: query.pageSize,
  });
});

// Get vendor by ID
vendorsRouter.get('/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const vendorId = c.req.param('id');

  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.tenantId, tenantId)));

  if (!vendor) {
    return c.json({ error: 'Vendor not found' }, 404);
  }

  return c.json({ vendor });
});

// Create vendor
vendorsRouter.post('/', zValidator('json', createVendorSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  const vendorId = generateId('vnd');

  await db.insert(vendors).values({
    id: vendorId,
    tenantId,
    name: data.name,
    type: data.type,
    company: data.company || null,
    email: data.email || null,
    phone: data.phone || null,
    address: data.address || null,
    serviceAreas: data.serviceAreas || null,
    specialties: data.specialties || null,
    hourlyRate: data.hourlyRate || null,
    currency: data.currency,
    status: 'active',
    rating: data.rating || null,
    notes: data.notes || null,
    createdAt: now,
    updatedAt: now,
  });

  const [newVendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId));

  return c.json({ vendor: newVendor }, 201);
});

// Update vendor
vendorsRouter.patch('/:id', zValidator('json', updateVendorSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const vendorId = c.req.param('id');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.tenantId, tenantId)));

  if (!vendor) {
    return c.json({ error: 'Vendor not found' }, 404);
  }

  const updates: Partial<typeof vendor> = { updatedAt: now };

  if (data.name !== undefined) updates.name = data.name;
  if (data.type !== undefined) updates.type = data.type;
  if (data.company !== undefined) updates.company = data.company;
  if (data.email !== undefined) updates.email = data.email;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.address !== undefined) updates.address = data.address;
  if (data.serviceAreas !== undefined) updates.serviceAreas = data.serviceAreas;
  if (data.specialties !== undefined) updates.specialties = data.specialties;
  if (data.hourlyRate !== undefined) updates.hourlyRate = data.hourlyRate;
  if (data.currency !== undefined) updates.currency = data.currency;
  if (data.rating !== undefined) updates.rating = data.rating;
  if (data.notes !== undefined) updates.notes = data.notes;

  await db.update(vendors).set(updates).where(eq(vendors.id, vendorId));

  const [updated] = await db.select().from(vendors).where(eq(vendors.id, vendorId));

  return c.json({ vendor: updated });
});

// Deactivate vendor
vendorsRouter.post('/:id/deactivate', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const vendorId = c.req.param('id');
  const now = new Date().toISOString();

  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.tenantId, tenantId)));

  if (!vendor) {
    return c.json({ error: 'Vendor not found' }, 404);
  }

  await db
    .update(vendors)
    .set({ status: 'inactive', updatedAt: now })
    .where(eq(vendors.id, vendorId));

  return c.json({ success: true });
});

// Reactivate vendor
vendorsRouter.post('/:id/activate', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const vendorId = c.req.param('id');
  const now = new Date().toISOString();

  const [vendor] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.tenantId, tenantId)));

  if (!vendor) {
    return c.json({ error: 'Vendor not found' }, 404);
  }

  await db
    .update(vendors)
    .set({ status: 'active', updatedAt: now })
    .where(eq(vendors.id, vendorId));

  return c.json({ success: true });
});
