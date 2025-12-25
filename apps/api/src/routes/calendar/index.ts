import { Hono } from 'hono';
import type { AppEnv } from '../../lib/context';
import { authMiddleware, requirePermission } from '../../middleware/auth';
import { tenancyMiddleware, requireTenant } from '../../middleware/tenancy';
import { success, error, notFound, conflict } from '../../lib/responses';
import {
  checkAvailabilitySchema,
  createBlockSchema,
  updateBlockSchema,
  createHoldSchema,
  confirmHoldSchema,
  releaseHoldSchema,
  getCalendarSchema,
} from '@propflow360/validators';
import { icsRouter } from './ics';

export const calendarRouter = new Hono<AppEnv>();

// ICS routes (some don't require auth - token-based)
calendarRouter.route('/ics', icsRouter);

// Apply middleware to other routes
calendarRouter.use('*', authMiddleware);
calendarRouter.use('*', tenancyMiddleware);

/**
 * Check availability for a unit
 * GET /calendar/availability?unitId=xxx&startDate=2024-01-01&endDate=2024-01-07
 */
calendarRouter.get('/availability', requireTenant, async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;

  const query = c.req.query();
  const parsed = checkAvailabilitySchema.safeParse({
    unitId: query.unitId,
    startDate: query.startDate,
    endDate: query.endDate,
  });

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid parameters', 400, parsed.error.flatten());
  }

  const { unitId, startDate, endDate } = parsed.data;

  try {
    // Get existing blocks from D1
    const blocks = await db
      .prepare(
        `SELECT start_date as startDate, end_date as endDate, block_type as blockType
         FROM availability_blocks
         WHERE tenant_id = ? AND unit_id = ?
           AND start_date < ? AND end_date > ?`
      )
      .bind(tenantId, unitId, endDate, startDate)
      .all();

    // Check with UnitLock DO
    const unitLockId = c.env.DO_UNIT_LOCK.idFromName(unitId);
    const unitLock = c.env.DO_UNIT_LOCK.get(unitLockId);

    const response = await unitLock.fetch(new Request('https://do/check', {
      method: 'POST',
      body: JSON.stringify({
        startDate,
        endDate,
        existingBlocks: blocks.results.map((b: any) => ({
          startDate: b.startDate,
          endDate: b.endDate,
        })),
      }),
    }));

    const result = await response.json() as { success: boolean; available?: boolean; reason?: string };

    if (!result.success) {
      return error(c, 'DO_ERROR', 'Failed to check availability', 500);
    }

    return success(c, {
      available: result.available,
      reason: result.reason,
      existingBlocks: blocks.results,
    });
  } catch (err) {
    console.error('Check availability error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to check availability', 500);
  }
});

/**
 * Get calendar for a unit or property
 * GET /calendar?unitId=xxx&startDate=2024-01-01&endDate=2024-01-31
 * GET /calendar?propertyId=xxx&startDate=2024-01-01&endDate=2024-01-31
 */
calendarRouter.get('/', requireTenant, async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;

  const query = c.req.query();
  const parsed = getCalendarSchema.safeParse({
    unitId: query.unitId,
    propertyId: query.propertyId,
    startDate: query.startDate,
    endDate: query.endDate,
    includeHolds: query.includeHolds === 'true',
  });

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid parameters', 400, parsed.error.flatten());
  }

  const { unitId, propertyId, startDate, endDate, includeHolds } = parsed.data;

  try {
    let blocksQuery: string;
    let bindings: any[];

    if (unitId) {
      blocksQuery = `
        SELECT ab.id, ab.unit_id as unitId, ab.block_type as blockType,
               ab.start_date as startDate, ab.end_date as endDate,
               ab.booking_id as bookingId, ab.notes, ab.source,
               u.name as unitName
        FROM availability_blocks ab
        JOIN units u ON u.id = ab.unit_id
        WHERE ab.tenant_id = ? AND ab.unit_id = ?
          AND ab.start_date < ? AND ab.end_date > ?
        ORDER BY ab.start_date
      `;
      bindings = [tenantId, unitId, endDate, startDate];
    } else {
      // Get all units for property
      blocksQuery = `
        SELECT ab.id, ab.unit_id as unitId, ab.block_type as blockType,
               ab.start_date as startDate, ab.end_date as endDate,
               ab.booking_id as bookingId, ab.notes, ab.source,
               u.name as unitName
        FROM availability_blocks ab
        JOIN units u ON u.id = ab.unit_id
        WHERE ab.tenant_id = ? AND u.property_id = ?
          AND ab.start_date < ? AND ab.end_date > ?
        ORDER BY ab.unit_id, ab.start_date
      `;
      bindings = [tenantId, propertyId, endDate, startDate];
    }

    const blocks = await db.prepare(blocksQuery).bind(...bindings).all();

    // Group by unit if fetching by property
    let result: any;
    if (propertyId) {
      const byUnit: Record<string, any[]> = {};
      for (const block of blocks.results as any[]) {
        if (!byUnit[block.unitId]) {
          byUnit[block.unitId] = [];
        }
        byUnit[block.unitId].push(block);
      }
      result = { blocks: byUnit, startDate, endDate };
    } else {
      result = { blocks: blocks.results, startDate, endDate };
    }

    // Include active holds if requested
    if (includeHolds && unitId) {
      const unitLockId = c.env.DO_UNIT_LOCK.idFromName(unitId);
      const unitLock = c.env.DO_UNIT_LOCK.get(unitLockId);

      const holdsResponse = await unitLock.fetch(new Request('https://do/holds', {
        method: 'POST',
        body: JSON.stringify({ startDate, endDate }),
      }));

      const holdsResult = await holdsResponse.json() as { success: boolean; holds?: any[] };
      if (holdsResult.success) {
        result.holds = holdsResult.holds;
      }
    }

    return success(c, result);
  } catch (err) {
    console.error('Get calendar error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to get calendar', 500);
  }
});

/**
 * Create an availability block (manual block, maintenance, etc.)
 * POST /calendar/blocks
 */
calendarRouter.post('/blocks', requireTenant, requirePermission('calendar:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;

  const body = await c.req.json();
  const parsed = createBlockSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid block data', 400, parsed.error.flatten());
  }

  const { unitId, blockType, startDate, endDate, bookingId, notes, source, externalId } = parsed.data;

  try {
    // Verify unit exists and belongs to tenant
    const unit = await db
      .prepare('SELECT id FROM units WHERE id = ? AND tenant_id = ?')
      .bind(unitId, tenantId)
      .first();

    if (!unit) {
      return notFound(c, 'Unit not found');
    }

    // Check availability first
    const existingBlocks = await db
      .prepare(
        `SELECT start_date as startDate, end_date as endDate
         FROM availability_blocks
         WHERE tenant_id = ? AND unit_id = ?
           AND start_date < ? AND end_date > ?`
      )
      .bind(tenantId, unitId, endDate, startDate)
      .all();

    // Check with DO for holds
    const unitLockId = c.env.DO_UNIT_LOCK.idFromName(unitId);
    const unitLock = c.env.DO_UNIT_LOCK.get(unitLockId);

    const checkResponse = await unitLock.fetch(new Request('https://do/check', {
      method: 'POST',
      body: JSON.stringify({
        startDate,
        endDate,
        existingBlocks: existingBlocks.results,
      }),
    }));

    const checkResult = await checkResponse.json() as { success: boolean; available?: boolean };

    if (!checkResult.available) {
      return conflict(c, 'Dates are not available');
    }

    // Create the block
    const blockId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO availability_blocks
         (id, tenant_id, unit_id, block_type, start_date, end_date, booking_id, notes, source, external_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(blockId, tenantId, unitId, blockType, startDate, endDate, bookingId || null, notes || null, source || 'manual', externalId || null, now, now)
      .run();

    return success(c, {
      id: blockId,
      unitId,
      blockType,
      startDate,
      endDate,
    }, 201);
  } catch (err) {
    console.error('Create block error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to create block', 500);
  }
});

/**
 * Update an availability block
 * PATCH /calendar/blocks/:id
 */
calendarRouter.patch('/blocks/:id', requireTenant, requirePermission('calendar:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const blockId = c.req.param('id');

  const body = await c.req.json();
  const parsed = updateBlockSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid update data', 400, parsed.error.flatten());
  }

  try {
    // Check block exists
    const existingBlock = await db
      .prepare('SELECT * FROM availability_blocks WHERE id = ? AND tenant_id = ?')
      .bind(blockId, tenantId)
      .first<any>();

    if (!existingBlock) {
      return notFound(c, 'Block not found');
    }

    // Build update
    const updates: string[] = [];
    const values: any[] = [];

    if (parsed.data.blockType) {
      updates.push('block_type = ?');
      values.push(parsed.data.blockType);
    }
    if (parsed.data.startDate) {
      updates.push('start_date = ?');
      values.push(parsed.data.startDate);
    }
    if (parsed.data.endDate) {
      updates.push('end_date = ?');
      values.push(parsed.data.endDate);
    }
    if (parsed.data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(parsed.data.notes);
    }

    if (updates.length === 0) {
      return success(c, existingBlock);
    }

    updates.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));

    values.push(blockId, tenantId);

    await db
      .prepare(`UPDATE availability_blocks SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`)
      .bind(...values)
      .run();

    // Fetch updated block
    const updatedBlock = await db
      .prepare('SELECT * FROM availability_blocks WHERE id = ?')
      .bind(blockId)
      .first();

    return success(c, updatedBlock);
  } catch (err) {
    console.error('Update block error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to update block', 500);
  }
});

/**
 * Delete an availability block
 * DELETE /calendar/blocks/:id
 */
calendarRouter.delete('/blocks/:id', requireTenant, requirePermission('calendar:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const blockId = c.req.param('id');

  try {
    const result = await db
      .prepare('DELETE FROM availability_blocks WHERE id = ? AND tenant_id = ?')
      .bind(blockId, tenantId)
      .run();

    if (result.meta.changes === 0) {
      return notFound(c, 'Block not found');
    }

    return success(c, { deleted: true });
  } catch (err) {
    console.error('Delete block error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to delete block', 500);
  }
});

/**
 * Create a temporary hold (for booking flow)
 * POST /calendar/holds
 */
calendarRouter.post('/holds', requireTenant, async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;

  const body = await c.req.json();
  const parsed = createHoldSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid hold data', 400, parsed.error.flatten());
  }

  const { unitId, startDate, endDate, ttlMinutes } = parsed.data;

  try {
    // Verify unit exists
    const unit = await db
      .prepare('SELECT id FROM units WHERE id = ? AND tenant_id = ?')
      .bind(unitId, tenantId)
      .first();

    if (!unit) {
      return notFound(c, 'Unit not found');
    }

    // Get existing blocks
    const existingBlocks = await db
      .prepare(
        `SELECT start_date as startDate, end_date as endDate
         FROM availability_blocks
         WHERE tenant_id = ? AND unit_id = ?
           AND start_date < ? AND end_date > ?`
      )
      .bind(tenantId, unitId, endDate, startDate)
      .all();

    // Create hold via DO
    const unitLockId = c.env.DO_UNIT_LOCK.idFromName(unitId);
    const unitLock = c.env.DO_UNIT_LOCK.get(unitLockId);

    const response = await unitLock.fetch(new Request('https://do/hold', {
      method: 'POST',
      body: JSON.stringify({
        startDate,
        endDate,
        ttlMinutes,
        existingBlocks: existingBlocks.results,
      }),
    }));

    const result = await response.json() as any;

    if (!result.success) {
      return conflict(c, result.error || 'Failed to create hold');
    }

    return success(c, {
      holdToken: result.holdToken,
      unitId,
      startDate,
      endDate,
      expiresAt: result.expiresAt,
      expiresIn: result.expiresIn,
    }, 201);
  } catch (err) {
    console.error('Create hold error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to create hold', 500);
  }
});

/**
 * Confirm a hold (convert to booking block)
 * POST /calendar/holds/confirm
 */
calendarRouter.post('/holds/confirm', requireTenant, async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;

  const body = await c.req.json();
  const parsed = confirmHoldSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid confirm data', 400, parsed.error.flatten());
  }

  const { holdToken, bookingId } = parsed.data;

  try {
    // We need to find which unit this hold belongs to
    // In a real implementation, you'd store the hold token with unit info
    // For now, we need to get it from the request or a lookup table
    const unitId = (body as any).unitId;

    if (!unitId) {
      return error(c, 'VALIDATION_ERROR', 'unitId is required', 400);
    }

    // Confirm with DO
    const unitLockId = c.env.DO_UNIT_LOCK.idFromName(unitId);
    const unitLock = c.env.DO_UNIT_LOCK.get(unitLockId);

    const response = await unitLock.fetch(new Request('https://do/confirm', {
      method: 'POST',
      body: JSON.stringify({ holdToken }),
    }));

    const result = await response.json() as any;

    if (!result.success) {
      return error(c, 'HOLD_ERROR', result.error || 'Failed to confirm hold', response.status);
    }

    // Create the booking block in D1
    const blockId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO availability_blocks
         (id, tenant_id, unit_id, block_type, start_date, end_date, booking_id, source, created_at, updated_at)
         VALUES (?, ?, ?, 'booking', ?, ?, ?, 'api', ?, ?)`
      )
      .bind(blockId, tenantId, unitId, result.startDate, result.endDate, bookingId, now, now)
      .run();

    return success(c, {
      blockId,
      bookingId,
      startDate: result.startDate,
      endDate: result.endDate,
    });
  } catch (err) {
    console.error('Confirm hold error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to confirm hold', 500);
  }
});

/**
 * Release a hold
 * POST /calendar/holds/release
 */
calendarRouter.post('/holds/release', requireTenant, async (c) => {
  const body = await c.req.json();
  const parsed = releaseHoldSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid release data', 400, parsed.error.flatten());
  }

  const { holdToken } = parsed.data;
  const unitId = (body as any).unitId;

  if (!unitId) {
    return error(c, 'VALIDATION_ERROR', 'unitId is required', 400);
  }

  try {
    const unitLockId = c.env.DO_UNIT_LOCK.idFromName(unitId);
    const unitLock = c.env.DO_UNIT_LOCK.get(unitLockId);

    const response = await unitLock.fetch(new Request('https://do/release', {
      method: 'POST',
      body: JSON.stringify({ holdToken }),
    }));

    const result = await response.json() as any;

    return success(c, { released: result.success });
  } catch (err) {
    console.error('Release hold error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to release hold', 500);
  }
});
