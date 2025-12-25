import { Hono } from 'hono';
import type { AppEnv } from '../../lib/context';
import { authMiddleware, requirePermission } from '../../middleware/auth';
import { tenancyMiddleware, requireTenant } from '../../middleware/tenancy';
import { success, error, notFound, conflict, paginated } from '../../lib/responses';
import {
  createLeaseSchema,
  updateLeaseSchema,
  terminateLeaseSchema,
  listLeasesSchema,
} from '@propflow360/validators';

export const leasesRouter = new Hono<AppEnv>();

// Apply middleware
leasesRouter.use('*', authMiddleware);
leasesRouter.use('*', tenancyMiddleware);

/**
 * Generate a unique lease reference
 */
function generateLeaseRef(): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let ref = `L${year}-`;
  for (let i = 0; i < 6; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

/**
 * Generate rent schedule for a lease
 */
function generateRentSchedule(
  leaseId: string,
  tenantId: string,
  startDate: string,
  endDate: string,
  monthlyRent: number,
  rentDueDay: number,
  paymentFrequency: string,
  currency: string
): Array<{
  id: string;
  tenantId: string;
  leaseId: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: number;
}> {
  const schedule: ReturnType<typeof generateRentSchedule> = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = Math.floor(Date.now() / 1000);

  let currentPeriodStart = new Date(start);
  let periodNumber = 0;

  while (currentPeriodStart < end) {
    let currentPeriodEnd: Date;
    let amount: number;

    switch (paymentFrequency) {
      case 'weekly':
        currentPeriodEnd = new Date(currentPeriodStart);
        currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 7);
        amount = Math.round(monthlyRent * 12 / 52); // Weekly amount
        break;
      case 'fortnightly':
        currentPeriodEnd = new Date(currentPeriodStart);
        currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 14);
        amount = Math.round(monthlyRent * 12 / 26); // Fortnightly amount
        break;
      case 'quarterly':
        currentPeriodEnd = new Date(currentPeriodStart);
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 3);
        amount = monthlyRent * 3;
        break;
      case 'monthly':
      default:
        currentPeriodEnd = new Date(currentPeriodStart);
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
        amount = monthlyRent;
        break;
    }

    // Don't go past lease end
    if (currentPeriodEnd > end) {
      currentPeriodEnd = new Date(end);
      // Pro-rate the last period
      const fullPeriodDays = paymentFrequency === 'monthly' ? 30 : paymentFrequency === 'weekly' ? 7 : 14;
      const actualDays = Math.ceil((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
      amount = Math.round(amount * actualDays / fullPeriodDays);
    }

    // Calculate due date
    let dueDate = new Date(currentPeriodStart);
    dueDate.setDate(rentDueDay);
    if (dueDate < currentPeriodStart) {
      // If due day is before period start, set to period start
      dueDate = new Date(currentPeriodStart);
    }

    schedule.push({
      id: crypto.randomUUID(),
      tenantId,
      leaseId,
      dueDate: dueDate.toISOString().split('T')[0],
      periodStart: currentPeriodStart.toISOString().split('T')[0],
      periodEnd: currentPeriodEnd.toISOString().split('T')[0],
      amount,
      currency,
      status: 'scheduled',
      createdAt: now,
    });

    currentPeriodStart = currentPeriodEnd;
    periodNumber++;

    // Safety limit
    if (periodNumber > 120) break;
  }

  return schedule;
}

/**
 * List leases
 * GET /leases
 */
leasesRouter.get('/', requireTenant, requirePermission('leases:read'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;

  const query = c.req.query();
  const parsed = listLeasesSchema.safeParse(query);

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid parameters', 400, parsed.error.flatten());
  }

  const { propertyId, unitId, guestId, status, page, pageSize } = parsed.data;

  try {
    let whereClause = 'l.tenant_id = ?';
    const bindings: any[] = [tenantId];

    if (propertyId) {
      whereClause += ' AND l.property_id = ?';
      bindings.push(propertyId);
    }
    if (unitId) {
      whereClause += ' AND l.unit_id = ?';
      bindings.push(unitId);
    }
    if (guestId) {
      whereClause += ' AND l.guest_id = ?';
      bindings.push(guestId);
    }
    if (status) {
      whereClause += ' AND l.status = ?';
      bindings.push(status);
    }

    const countResult = await db
      .prepare(`SELECT COUNT(*) as count FROM leases l WHERE ${whereClause}`)
      .bind(...bindings)
      .first<{ count: number }>();

    const total = countResult?.count || 0;
    const offset = (page - 1) * pageSize;

    const leases = await db
      .prepare(
        `SELECT l.*,
                u.name as unit_name,
                p.name as property_name,
                g.first_name as guest_first_name,
                g.last_name as guest_last_name,
                g.email as guest_email
         FROM leases l
         JOIN units u ON u.id = l.unit_id
         JOIN properties p ON p.id = l.property_id
         JOIN guests g ON g.id = l.guest_id
         WHERE ${whereClause}
         ORDER BY l.start_date DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...bindings, pageSize, offset)
      .all();

    return paginated(c, leases.results, page, pageSize, total);
  } catch (err) {
    console.error('List leases error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to list leases', 500);
  }
});

/**
 * Get lease by ID
 * GET /leases/:id
 */
leasesRouter.get('/:id', requireTenant, requirePermission('leases:read'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const leaseId = c.req.param('id');

  try {
    const lease = await db
      .prepare(
        `SELECT l.*,
                u.name as unit_name,
                p.name as property_name,
                g.first_name as guest_first_name,
                g.last_name as guest_last_name,
                g.email as guest_email,
                g.phone as guest_phone
         FROM leases l
         JOIN units u ON u.id = l.unit_id
         JOIN properties p ON p.id = l.property_id
         JOIN guests g ON g.id = l.guest_id
         WHERE l.id = ? AND l.tenant_id = ?`
      )
      .bind(leaseId, tenantId)
      .first();

    if (!lease) {
      return notFound(c, 'Lease not found');
    }

    // Get rent schedule
    const schedule = await db
      .prepare(
        `SELECT * FROM lease_rent_schedule
         WHERE lease_id = ?
         ORDER BY due_date`
      )
      .bind(leaseId)
      .all();

    return success(c, {
      ...lease,
      rentSchedule: schedule.results,
    });
  } catch (err) {
    console.error('Get lease error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to get lease', 500);
  }
});

/**
 * Create a new lease
 * POST /leases
 */
leasesRouter.post('/', requireTenant, requirePermission('leases:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;

  const body = await c.req.json();
  const parsed = createLeaseSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid lease data', 400, parsed.error.flatten());
  }

  const data = parsed.data;

  try {
    // Get unit and property
    const unit = await db
      .prepare(
        `SELECT u.id, u.property_id, u.name, p.name as property_name, p.currency
         FROM units u
         JOIN properties p ON p.id = u.property_id
         WHERE u.id = ? AND u.tenant_id = ?`
      )
      .bind(data.unitId, tenantId)
      .first<any>();

    if (!unit) {
      return notFound(c, 'Unit not found');
    }

    // Check for overlapping leases
    const overlapping = await db
      .prepare(
        `SELECT id FROM leases
         WHERE tenant_id = ? AND unit_id = ?
           AND status IN ('active', 'pending_signature')
           AND start_date < ? AND end_date > ?`
      )
      .bind(tenantId, data.unitId, data.endDate, data.startDate)
      .first();

    if (overlapping) {
      return conflict(c, 'Unit has an overlapping active lease');
    }

    // Create or get guest
    let guestId = data.guestId;

    if (!guestId && data.guest) {
      const existingGuest = await db
        .prepare('SELECT id FROM guests WHERE tenant_id = ? AND email = ?')
        .bind(tenantId, data.guest.email)
        .first<{ id: string }>();

      if (existingGuest) {
        guestId = existingGuest.id;
      } else {
        guestId = crypto.randomUUID();
        const now = Math.floor(Date.now() / 1000);

        await db
          .prepare(
            `INSERT INTO guests (id, tenant_id, email, first_name, last_name, phone,
             address_line1, address_line2, city, state, postal_code, country, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            guestId, tenantId, data.guest.email, data.guest.firstName, data.guest.lastName,
            data.guest.phone || null, data.guest.addressLine1 || null, data.guest.addressLine2 || null,
            data.guest.city || null, data.guest.state || null, data.guest.postalCode || null,
            data.guest.country || null, data.guest.notes || null, now, now
          )
          .run();
      }
    }

    if (!guestId) {
      return error(c, 'VALIDATION_ERROR', 'Guest information is required', 400);
    }

    // Create lease
    const leaseId = crypto.randomUUID();
    const leaseRef = generateLeaseRef();
    const now = Math.floor(Date.now() / 1000);
    const currency = data.currency || unit.currency || 'GBP';

    await db
      .prepare(
        `INSERT INTO leases (
          id, tenant_id, property_id, unit_id, guest_id, lease_ref,
          start_date, end_date, lease_type, status, currency,
          monthly_rent, deposit, deposit_status,
          rent_due_day, payment_frequency,
          primary_occupant, additional_occupants,
          notice_period_days, break_clause_date, special_terms, internal_notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        leaseId, tenantId, unit.property_id, data.unitId, guestId, leaseRef,
        data.startDate, data.endDate, data.leaseType, 'draft', currency,
        data.monthlyRent, data.deposit || 0, 'pending',
        data.rentDueDay, data.paymentFrequency,
        data.primaryOccupant, data.additionalOccupants ? JSON.stringify(data.additionalOccupants) : null,
        data.noticePeriodDays, data.breakClauseDate || null, data.specialTerms || null, data.internalNotes || null,
        now, now
      )
      .run();

    // Generate rent schedule
    const schedule = generateRentSchedule(
      leaseId,
      tenantId,
      data.startDate,
      data.endDate,
      data.monthlyRent,
      data.rentDueDay,
      data.paymentFrequency,
      currency
    );

    // Insert rent schedule
    for (const item of schedule) {
      await db
        .prepare(
          `INSERT INTO lease_rent_schedule (id, tenant_id, lease_id, due_date, period_start, period_end, amount, currency, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(item.id, item.tenantId, item.leaseId, item.dueDate, item.periodStart, item.periodEnd, item.amount, item.currency, item.status, item.createdAt)
        .run();
    }

    // Create availability block for lease period
    const blockId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO availability_blocks (id, tenant_id, unit_id, block_type, start_date, end_date, notes, source, created_at, updated_at)
         VALUES (?, ?, ?, 'booking', ?, ?, ?, 'lease', ?, ?)`
      )
      .bind(blockId, tenantId, data.unitId, data.startDate, data.endDate, `Lease: ${leaseRef}`, now, now)
      .run();

    return success(c, {
      id: leaseId,
      leaseRef,
      status: 'draft',
      unitId: data.unitId,
      unitName: unit.name,
      propertyName: unit.property_name,
      startDate: data.startDate,
      endDate: data.endDate,
      monthlyRent: data.monthlyRent,
      currency,
      rentScheduleCount: schedule.length,
    }, 201);
  } catch (err) {
    console.error('Create lease error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to create lease', 500);
  }
});

/**
 * Update a lease
 * PATCH /leases/:id
 */
leasesRouter.patch('/:id', requireTenant, requirePermission('leases:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const leaseId = c.req.param('id');

  const body = await c.req.json();
  const parsed = updateLeaseSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid update data', 400, parsed.error.flatten());
  }

  try {
    const existing = await db
      .prepare('SELECT * FROM leases WHERE id = ? AND tenant_id = ?')
      .bind(leaseId, tenantId)
      .first<any>();

    if (!existing) {
      return notFound(c, 'Lease not found');
    }

    if (['terminated', 'expired'].includes(existing.status)) {
      return error(c, 'INVALID_STATUS', 'Cannot update terminated or expired leases', 400);
    }

    const updates: string[] = [];
    const values: any[] = [];
    const data = parsed.data;

    const simpleFields: Array<[string, keyof typeof data, string]> = [
      ['start_date', 'startDate', 'startDate'],
      ['end_date', 'endDate', 'endDate'],
      ['lease_type', 'leaseType', 'leaseType'],
      ['monthly_rent', 'monthlyRent', 'monthlyRent'],
      ['deposit', 'deposit', 'deposit'],
      ['rent_due_day', 'rentDueDay', 'rentDueDay'],
      ['payment_frequency', 'paymentFrequency', 'paymentFrequency'],
      ['primary_occupant', 'primaryOccupant', 'primaryOccupant'],
      ['notice_period_days', 'noticePeriodDays', 'noticePeriodDays'],
      ['break_clause_date', 'breakClauseDate', 'breakClauseDate'],
      ['special_terms', 'specialTerms', 'specialTerms'],
      ['internal_notes', 'internalNotes', 'internalNotes'],
    ];

    for (const [column, key] of simpleFields) {
      if (data[key] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(data[key]);
      }
    }

    if (data.additionalOccupants !== undefined) {
      updates.push('additional_occupants = ?');
      values.push(data.additionalOccupants ? JSON.stringify(data.additionalOccupants) : null);
    }

    if (updates.length === 0) {
      return success(c, existing);
    }

    updates.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));
    values.push(leaseId, tenantId);

    await db
      .prepare(`UPDATE leases SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`)
      .bind(...values)
      .run();

    const updated = await db
      .prepare('SELECT * FROM leases WHERE id = ?')
      .bind(leaseId)
      .first();

    return success(c, updated);
  } catch (err) {
    console.error('Update lease error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to update lease', 500);
  }
});

/**
 * Activate a lease
 * POST /leases/:id/activate
 */
leasesRouter.post('/:id/activate', requireTenant, requirePermission('leases:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const leaseId = c.req.param('id');

  try {
    const lease = await db
      .prepare('SELECT * FROM leases WHERE id = ? AND tenant_id = ?')
      .bind(leaseId, tenantId)
      .first<any>();

    if (!lease) {
      return notFound(c, 'Lease not found');
    }

    if (!['draft', 'pending_signature'].includes(lease.status)) {
      return error(c, 'INVALID_STATUS', `Cannot activate lease with status: ${lease.status}`, 400);
    }

    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare('UPDATE leases SET status = ?, signed_at = ?, updated_at = ? WHERE id = ?')
      .bind('active', now, now, leaseId)
      .run();

    return success(c, {
      id: leaseId,
      status: 'active',
      activatedAt: now,
    });
  } catch (err) {
    console.error('Activate lease error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to activate lease', 500);
  }
});

/**
 * Terminate a lease
 * POST /leases/:id/terminate
 */
leasesRouter.post('/:id/terminate', requireTenant, requirePermission('leases:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const userId = c.get('session')?.userId;
  const leaseId = c.req.param('id');

  const body = await c.req.json();
  const parsed = terminateLeaseSchema.safeParse({ ...body, leaseId });

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid terminate data', 400, parsed.error.flatten());
  }

  try {
    const lease = await db
      .prepare('SELECT * FROM leases WHERE id = ? AND tenant_id = ?')
      .bind(leaseId, tenantId)
      .first<any>();

    if (!lease) {
      return notFound(c, 'Lease not found');
    }

    if (['terminated', 'expired'].includes(lease.status)) {
      return error(c, 'INVALID_STATUS', `Lease is already ${lease.status}`, 400);
    }

    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `UPDATE leases
         SET status = 'terminated', terminated_at = ?, terminated_by = ?, termination_reason = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(now, userId || null, parsed.data.reason || null, now, leaseId)
      .run();

    // Cancel pending rent schedule items
    await db
      .prepare(
        `UPDATE lease_rent_schedule
         SET status = 'waived'
         WHERE lease_id = ? AND status = 'scheduled'`
      )
      .bind(leaseId)
      .run();

    // Update availability block end date
    const terminationDate = parsed.data.terminationDate || new Date().toISOString().split('T')[0];
    await db
      .prepare(
        `UPDATE availability_blocks
         SET end_date = ?, updated_at = ?
         WHERE unit_id = ? AND source = 'lease' AND end_date = ?`
      )
      .bind(terminationDate, now, lease.unit_id, lease.end_date)
      .run();

    return success(c, {
      id: leaseId,
      status: 'terminated',
      terminatedAt: now,
    });
  } catch (err) {
    console.error('Terminate lease error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to terminate lease', 500);
  }
});

/**
 * Get rent schedule for a lease
 * GET /leases/:id/rent-schedule
 */
leasesRouter.get('/:id/rent-schedule', requireTenant, requirePermission('leases:read'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const leaseId = c.req.param('id');

  try {
    const lease = await db
      .prepare('SELECT id FROM leases WHERE id = ? AND tenant_id = ?')
      .bind(leaseId, tenantId)
      .first();

    if (!lease) {
      return notFound(c, 'Lease not found');
    }

    const schedule = await db
      .prepare('SELECT * FROM lease_rent_schedule WHERE lease_id = ? ORDER BY due_date')
      .bind(leaseId)
      .all();

    return success(c, schedule.results);
  } catch (err) {
    console.error('Get rent schedule error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to get rent schedule', 500);
  }
});
