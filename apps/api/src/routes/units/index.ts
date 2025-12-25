import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { nanoid } from 'nanoid';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import {
  createUnitSchema,
  updateUnitSchema,
  listUnitsSchema,
  createUnitPricingSchema,
  updateUnitPricingSchema,
} from '@propflow360/validators';
import { units, unitPricing, properties } from '@propflow360/db/schema';
import type { AppEnv } from '../../lib/context';
import { success, created, noContent, notFound, badRequest } from '../../lib/responses';
import { authMiddleware, requirePermission } from '../../middleware/auth';
import { tenancyMiddleware, requireTenant } from '../../middleware/tenancy';
import { generateSecureToken } from '@propflow360/auth';

const unitsRouter = new Hono<AppEnv>();

// Apply middleware to all routes
unitsRouter.use('*', authMiddleware);
unitsRouter.use('*', tenancyMiddleware);
unitsRouter.use('*', requireTenant);

// List units
unitsRouter.get(
  '/',
  requirePermission('units:read'),
  zValidator('query', listUnitsSchema),
  async (c) => {
    const db = c.get('db');
    const tenantId = c.get('tenantId')!;
    const { page, pageSize, sortBy, sortDirection, propertyId, status, type } = c.req.valid('query');

    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [eq(units.tenantId, tenantId)];

    if (propertyId) {
      conditions.push(eq(units.propertyId, propertyId));
    }

    if (status) {
      conditions.push(eq(units.status, status));
    }

    if (type) {
      conditions.push(eq(units.type, type));
    }

    const whereClause = and(...conditions);

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(units).where(whereClause);
    const total = countResult[0]?.count ?? 0;

    // Get paginated results
    const orderBy =
      sortBy === 'name'
        ? sortDirection === 'asc'
          ? asc(units.name)
          : desc(units.name)
        : sortDirection === 'asc'
          ? asc(units.createdAt)
          : desc(units.createdAt);

    const results = await db
      .select()
      .from(units)
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

// Get single unit with pricing
unitsRouter.get('/:id', requirePermission('units:read'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const unitId = c.req.param('id');

  const unit = await db.query.units.findFirst({
    where: and(eq(units.id, unitId), eq(units.tenantId, tenantId)),
  });

  if (!unit) {
    return notFound(c, 'Unit');
  }

  // Get pricing rules
  const pricing = await db
    .select()
    .from(unitPricing)
    .where(and(eq(unitPricing.unitId, unitId), eq(unitPricing.tenantId, tenantId)))
    .orderBy(desc(unitPricing.priority));

  return success(c, { ...unit, pricing });
});

// Create unit
unitsRouter.post(
  '/',
  requirePermission('units:write'),
  zValidator('json', createUnitSchema),
  async (c) => {
    const db = c.get('db');
    const tenantId = c.get('tenantId')!;
    const input = c.req.valid('json');

    // Verify property belongs to tenant
    const property = await db.query.properties.findFirst({
      where: and(eq(properties.id, input.propertyId), eq(properties.tenantId, tenantId)),
    });

    if (!property) {
      return badRequest(c, 'Property not found or does not belong to this tenant');
    }

    const unitId = nanoid();
    const icsToken = generateSecureToken(24);

    const newUnit = await db
      .insert(units)
      .values({
        id: unitId,
        tenantId,
        propertyId: input.propertyId,
        name: input.name,
        type: input.type,
        description: input.description,
        maxGuests: input.maxGuests,
        bedrooms: input.bedrooms,
        beds: input.beds,
        bathrooms: input.bathrooms,
        sizeSqm: input.sizeSqm,
        floor: input.floor,
        amenities: input.amenities,
        icsToken,
      })
      .returning();

    return created(c, newUnit[0]);
  }
);

// Update unit
unitsRouter.patch(
  '/:id',
  requirePermission('units:write'),
  zValidator('json', updateUnitSchema),
  async (c) => {
    const db = c.get('db');
    const tenantId = c.get('tenantId')!;
    const unitId = c.req.param('id');
    const input = c.req.valid('json');

    const existing = await db.query.units.findFirst({
      where: and(eq(units.id, unitId), eq(units.tenantId, tenantId)),
    });

    if (!existing) {
      return notFound(c, 'Unit');
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.maxGuests !== undefined) updateData.maxGuests = input.maxGuests;
    if (input.bedrooms !== undefined) updateData.bedrooms = input.bedrooms;
    if (input.beds !== undefined) updateData.beds = input.beds;
    if (input.bathrooms !== undefined) updateData.bathrooms = input.bathrooms;
    if (input.sizeSqm !== undefined) updateData.sizeSqm = input.sizeSqm;
    if (input.floor !== undefined) updateData.floor = input.floor;
    if (input.amenities !== undefined) updateData.amenities = input.amenities;
    if (input.status !== undefined) updateData.status = input.status;

    const updated = await db
      .update(units)
      .set(updateData)
      .where(and(eq(units.id, unitId), eq(units.tenantId, tenantId)))
      .returning();

    return success(c, updated[0]);
  }
);

// Delete (archive) unit
unitsRouter.delete('/:id', requirePermission('units:delete'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const unitId = c.req.param('id');

  const existing = await db.query.units.findFirst({
    where: and(eq(units.id, unitId), eq(units.tenantId, tenantId)),
  });

  if (!existing) {
    return notFound(c, 'Unit');
  }

  await db
    .update(units)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(and(eq(units.id, unitId), eq(units.tenantId, tenantId)));

  return noContent(c);
});

// ----- Pricing Routes -----

// Get unit pricing
unitsRouter.get('/:id/pricing', requirePermission('units:read'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const unitId = c.req.param('id');

  const unit = await db.query.units.findFirst({
    where: and(eq(units.id, unitId), eq(units.tenantId, tenantId)),
  });

  if (!unit) {
    return notFound(c, 'Unit');
  }

  const pricing = await db
    .select()
    .from(unitPricing)
    .where(and(eq(unitPricing.unitId, unitId), eq(unitPricing.tenantId, tenantId)))
    .orderBy(desc(unitPricing.priority));

  return success(c, pricing);
});

// Add pricing rule
unitsRouter.post(
  '/:id/pricing',
  requirePermission('units:write'),
  zValidator('json', createUnitPricingSchema.omit({ unitId: true })),
  async (c) => {
    const db = c.get('db');
    const tenantId = c.get('tenantId')!;
    const unitId = c.req.param('id');
    const input = c.req.valid('json');

    // Verify unit belongs to tenant
    const unit = await db.query.units.findFirst({
      where: and(eq(units.id, unitId), eq(units.tenantId, tenantId)),
    });

    if (!unit) {
      return notFound(c, 'Unit');
    }

    const pricingId = nanoid();

    const newPricing = await db
      .insert(unitPricing)
      .values({
        id: pricingId,
        tenantId,
        unitId,
        name: input.name,
        priceType: input.priceType,
        basePrice: input.basePrice,
        minStay: input.minStay,
        maxStay: input.maxStay,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        daysOfWeek: input.daysOfWeek,
        priority: input.priority,
      })
      .returning();

    return created(c, newPricing[0]);
  }
);

// Update pricing rule
unitsRouter.patch(
  '/:id/pricing/:pricingId',
  requirePermission('units:write'),
  zValidator('json', updateUnitPricingSchema),
  async (c) => {
    const db = c.get('db');
    const tenantId = c.get('tenantId')!;
    const unitId = c.req.param('id');
    const pricingId = c.req.param('pricingId');
    const input = c.req.valid('json');

    const existing = await db.query.unitPricing.findFirst({
      where: and(
        eq(unitPricing.id, pricingId),
        eq(unitPricing.unitId, unitId),
        eq(unitPricing.tenantId, tenantId)
      ),
    });

    if (!existing) {
      return notFound(c, 'Pricing rule');
    }

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.priceType !== undefined) updateData.priceType = input.priceType;
    if (input.basePrice !== undefined) updateData.basePrice = input.basePrice;
    if (input.minStay !== undefined) updateData.minStay = input.minStay;
    if (input.maxStay !== undefined) updateData.maxStay = input.maxStay;
    if (input.dateFrom !== undefined) updateData.dateFrom = input.dateFrom;
    if (input.dateTo !== undefined) updateData.dateTo = input.dateTo;
    if (input.daysOfWeek !== undefined) updateData.daysOfWeek = input.daysOfWeek;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const updated = await db
      .update(unitPricing)
      .set(updateData)
      .where(
        and(
          eq(unitPricing.id, pricingId),
          eq(unitPricing.unitId, unitId),
          eq(unitPricing.tenantId, tenantId)
        )
      )
      .returning();

    return success(c, updated[0]);
  }
);

// Delete pricing rule
unitsRouter.delete('/:id/pricing/:pricingId', requirePermission('units:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const unitId = c.req.param('id');
  const pricingId = c.req.param('pricingId');

  const existing = await db.query.unitPricing.findFirst({
    where: and(
      eq(unitPricing.id, pricingId),
      eq(unitPricing.unitId, unitId),
      eq(unitPricing.tenantId, tenantId)
    ),
  });

  if (!existing) {
    return notFound(c, 'Pricing rule');
  }

  await db.delete(unitPricing).where(eq(unitPricing.id, pricingId));

  return noContent(c);
});

export { unitsRouter };
