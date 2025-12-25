import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { nanoid } from 'nanoid';
import { eq, and, like, desc, asc, sql } from 'drizzle-orm';
import {
  createPropertySchema,
  updatePropertySchema,
  listPropertiesSchema,
} from '@propflow360/validators';
import { properties } from '@propflow360/db/schema';
import type { AppEnv } from '../../lib/context';
import { success, created, noContent, notFound, badRequest } from '../../lib/responses';
import { authMiddleware, requirePermission } from '../../middleware/auth';
import { tenancyMiddleware, requireTenant } from '../../middleware/tenancy';

const propertiesRouter = new Hono<AppEnv>();

// Apply middleware to all routes
propertiesRouter.use('*', authMiddleware);
propertiesRouter.use('*', tenancyMiddleware);
propertiesRouter.use('*', requireTenant);

// List properties
propertiesRouter.get(
  '/',
  requirePermission('properties:read'),
  zValidator('query', listPropertiesSchema),
  async (c) => {
    const db = c.get('db');
    const tenantId = c.get('tenantId')!;
    const { page, pageSize, sortBy, sortDirection, status, type, search } = c.req.valid('query');

    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(properties.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(properties.status, status));
    }

    if (type) {
      conditions.push(eq(properties.type, type));
    }

    if (search) {
      conditions.push(like(properties.name, `%${search}%`));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(properties)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    // Get paginated results
    const orderBy =
      sortBy === 'name'
        ? sortDirection === 'asc'
          ? asc(properties.name)
          : desc(properties.name)
        : sortDirection === 'asc'
          ? asc(properties.createdAt)
          : desc(properties.createdAt);

    const results = await db
      .select()
      .from(properties)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    return success(c, results, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  }
);

// Get single property
propertiesRouter.get('/:id', requirePermission('properties:read'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const propertyId = c.req.param('id');

  const property = await db.query.properties.findFirst({
    where: and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)),
  });

  if (!property) {
    return notFound(c, 'Property');
  }

  return success(c, property);
});

// Create property
propertiesRouter.post(
  '/',
  requirePermission('properties:write'),
  zValidator('json', createPropertySchema),
  async (c) => {
    const db = c.get('db');
    const tenantId = c.get('tenantId')!;
    const input = c.req.valid('json');

    const propertyId = nanoid();

    const newProperty = await db
      .insert(properties)
      .values({
        id: propertyId,
        tenantId,
        name: input.name,
        type: input.type,
        description: input.description,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country,
        latitude: input.latitude,
        longitude: input.longitude,
        timezone: input.timezone,
        currency: input.currency,
        checkInTime: input.checkInTime,
        checkOutTime: input.checkOutTime,
        settings: input.settings,
      })
      .returning();

    return created(c, newProperty[0]);
  }
);

// Update property
propertiesRouter.patch(
  '/:id',
  requirePermission('properties:write'),
  zValidator('json', updatePropertySchema),
  async (c) => {
    const db = c.get('db');
    const tenantId = c.get('tenantId')!;
    const propertyId = c.req.param('id');
    const input = c.req.valid('json');

    // Check if property exists
    const existing = await db.query.properties.findFirst({
      where: and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)),
    });

    if (!existing) {
      return notFound(c, 'Property');
    }

    // Build update object, only including provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.addressLine1 !== undefined) updateData.addressLine1 = input.addressLine1;
    if (input.addressLine2 !== undefined) updateData.addressLine2 = input.addressLine2;
    if (input.city !== undefined) updateData.city = input.city;
    if (input.state !== undefined) updateData.state = input.state;
    if (input.postalCode !== undefined) updateData.postalCode = input.postalCode;
    if (input.country !== undefined) updateData.country = input.country;
    if (input.latitude !== undefined) updateData.latitude = input.latitude;
    if (input.longitude !== undefined) updateData.longitude = input.longitude;
    if (input.timezone !== undefined) updateData.timezone = input.timezone;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.checkInTime !== undefined) updateData.checkInTime = input.checkInTime;
    if (input.checkOutTime !== undefined) updateData.checkOutTime = input.checkOutTime;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.settings !== undefined) updateData.settings = input.settings;

    const updated = await db
      .update(properties)
      .set(updateData)
      .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)))
      .returning();

    return success(c, updated[0]);
  }
);

// Delete (archive) property
propertiesRouter.delete('/:id', requirePermission('properties:delete'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const propertyId = c.req.param('id');

  const existing = await db.query.properties.findFirst({
    where: and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)),
  });

  if (!existing) {
    return notFound(c, 'Property');
  }

  // Soft delete by setting status to archived
  await db
    .update(properties)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)));

  return noContent(c);
});

export { propertiesRouter };
