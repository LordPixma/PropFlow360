import { Hono } from 'hono';
import type { AppEnv } from '../../lib/context';
import { authMiddleware, requirePermission } from '../../middleware/auth';
import { tenancyMiddleware, requireTenant } from '../../middleware/tenancy';
import { success, error, notFound, conflict, paginated } from '../../lib/responses';
import {
  createBookingSchema,
  updateBookingSchema,
  cancelBookingSchema,
  listBookingsSchema,
} from '@propflow360/validators';
import { queueNotification, NotificationEvents } from '@propflow360/notifications';
import { drizzle } from 'drizzle-orm/d1';

export const bookingsRouter = new Hono<AppEnv>();

// Apply middleware
bookingsRouter.use('*', authMiddleware);
bookingsRouter.use('*', tenancyMiddleware);

/**
 * Generate a unique booking reference
 */
function generateBookingRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = '';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

/**
 * Calculate number of nights between two dates
 */
function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * List bookings
 * GET /bookings
 */
bookingsRouter.get('/', requireTenant, requirePermission('bookings:read'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;

  const query = c.req.query();
  const parsed = listBookingsSchema.safeParse(query);

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid parameters', 400, parsed.error.flatten());
  }

  const { propertyId, unitId, guestId, status, source, startDate, endDate, page, pageSize } = parsed.data;

  try {
    // Build query
    let whereClause = 'b.tenant_id = ?';
    const bindings: any[] = [tenantId];

    if (propertyId) {
      whereClause += ' AND b.property_id = ?';
      bindings.push(propertyId);
    }
    if (unitId) {
      whereClause += ' AND b.unit_id = ?';
      bindings.push(unitId);
    }
    if (guestId) {
      whereClause += ' AND b.guest_id = ?';
      bindings.push(guestId);
    }
    if (status) {
      whereClause += ' AND b.status = ?';
      bindings.push(status);
    }
    if (source) {
      whereClause += ' AND b.source = ?';
      bindings.push(source);
    }
    if (startDate) {
      whereClause += ' AND b.check_out_date >= ?';
      bindings.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND b.check_in_date <= ?';
      bindings.push(endDate);
    }

    // Count total
    const countResult = await db
      .prepare(`SELECT COUNT(*) as count FROM bookings b WHERE ${whereClause}`)
      .bind(...bindings)
      .first<{ count: number }>();

    const total = countResult?.count || 0;
    const offset = (page - 1) * pageSize;

    // Fetch bookings
    const bookings = await db
      .prepare(
        `SELECT b.*,
                u.name as unit_name,
                p.name as property_name,
                g.first_name as guest_first_name,
                g.last_name as guest_last_name,
                g.email as guest_email
         FROM bookings b
         JOIN units u ON u.id = b.unit_id
         JOIN properties p ON p.id = b.property_id
         JOIN guests g ON g.id = b.guest_id
         WHERE ${whereClause}
         ORDER BY b.check_in_date DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...bindings, pageSize, offset)
      .all();

    return paginated(c, bookings.results, page, pageSize, total);
  } catch (err) {
    console.error('List bookings error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to list bookings', 500);
  }
});

/**
 * Get booking by ID
 * GET /bookings/:id
 */
bookingsRouter.get('/:id', requireTenant, requirePermission('bookings:read'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const bookingId = c.req.param('id');

  try {
    const booking = await db
      .prepare(
        `SELECT b.*,
                u.name as unit_name, u.property_id,
                p.name as property_name,
                g.first_name as guest_first_name,
                g.last_name as guest_last_name,
                g.email as guest_email,
                g.phone as guest_phone
         FROM bookings b
         JOIN units u ON u.id = b.unit_id
         JOIN properties p ON p.id = b.property_id
         JOIN guests g ON g.id = b.guest_id
         WHERE b.id = ? AND b.tenant_id = ?`
      )
      .bind(bookingId, tenantId)
      .first();

    if (!booking) {
      return notFound(c, 'Booking not found');
    }

    return success(c, booking);
  } catch (err) {
    console.error('Get booking error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to get booking', 500);
  }
});

/**
 * Create a new booking
 * POST /bookings
 *
 * This implements the booking workflow:
 * 1. Validate availability
 * 2. Create/get guest
 * 3. Create booking with 'pending' status
 * 4. Create availability block
 */
bookingsRouter.post('/', requireTenant, requirePermission('bookings:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;

  const body = await c.req.json();
  const parsed = createBookingSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid booking data', 400, parsed.error.flatten());
  }

  const data = parsed.data;

  try {
    // Get unit and property
    const unit = await db
      .prepare(
        `SELECT u.id, u.property_id, u.name, p.name as property_name,
                p.check_in_time, p.check_out_time, p.currency
         FROM units u
         JOIN properties p ON p.id = u.property_id
         WHERE u.id = ? AND u.tenant_id = ?`
      )
      .bind(data.unitId, tenantId)
      .first<any>();

    if (!unit) {
      return notFound(c, 'Unit not found');
    }

    // Check availability
    const existingBlocks = await db
      .prepare(
        `SELECT id, start_date, end_date FROM availability_blocks
         WHERE tenant_id = ? AND unit_id = ?
           AND start_date < ? AND end_date > ?
           AND block_type != 'hold'`
      )
      .bind(tenantId, data.unitId, data.checkOutDate, data.checkInDate)
      .all();

    if (existingBlocks.results.length > 0) {
      return conflict(c, 'Unit is not available for selected dates');
    }

    // If using hold token, verify with DO
    if (data.holdToken) {
      const unitLockId = c.env.DO_UNIT_LOCK.idFromName(data.unitId);
      const unitLock = c.env.DO_UNIT_LOCK.get(unitLockId);

      const confirmResponse = await unitLock.fetch(new Request('https://do/confirm', {
        method: 'POST',
        body: JSON.stringify({ holdToken: data.holdToken }),
      }));

      const confirmResult = await confirmResponse.json() as any;

      if (!confirmResult.success) {
        return error(c, 'HOLD_ERROR', confirmResult.error || 'Hold expired or invalid', 410);
      }
    } else {
      // Check with DO for active holds
      const unitLockId = c.env.DO_UNIT_LOCK.idFromName(data.unitId);
      const unitLock = c.env.DO_UNIT_LOCK.get(unitLockId);

      const checkResponse = await unitLock.fetch(new Request('https://do/check', {
        method: 'POST',
        body: JSON.stringify({
          startDate: data.checkInDate,
          endDate: data.checkOutDate,
          existingBlocks: [],
        }),
      }));

      const checkResult = await checkResponse.json() as any;

      if (!checkResult.available) {
        return conflict(c, 'Dates are not available');
      }
    }

    // Create or get guest
    let guestId = data.guestId;

    if (!guestId && data.guest) {
      // Check if guest exists by email
      const existingGuest = await db
        .prepare('SELECT id FROM guests WHERE tenant_id = ? AND email = ?')
        .bind(tenantId, data.guest.email)
        .first<{ id: string }>();

      if (existingGuest) {
        guestId = existingGuest.id;
      } else {
        // Create new guest
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

    // Calculate pricing
    const totalNights = calculateNights(data.checkInDate, data.checkOutDate);
    const nightlyRate = data.nightlyRate || 0;
    const subtotal = nightlyRate * totalNights;
    const cleaningFee = data.cleaningFee || 0;
    const serviceFee = data.serviceFee || 0;
    const taxes = data.taxes || 0;
    const discount = data.discount || 0;
    const totalAmount = subtotal + cleaningFee + serviceFee + taxes - discount;

    // Create booking
    const bookingId = crypto.randomUUID();
    const bookingRef = generateBookingRef();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO bookings (
          id, tenant_id, property_id, unit_id, guest_id, booking_ref,
          check_in_date, check_out_date, check_in_time, check_out_time,
          adults, children, infants, status, currency,
          nightly_rate, total_nights, subtotal, cleaning_fee, service_fee, taxes, discount, total_amount,
          payment_status, source, external_id, guest_notes, internal_notes, special_requests,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        bookingId, tenantId, unit.property_id, data.unitId, guestId, bookingRef,
        data.checkInDate, data.checkOutDate,
        data.checkInTime || unit.check_in_time || null,
        data.checkOutTime || unit.check_out_time || null,
        data.adults, data.children, data.infants, 'pending', unit.currency || 'GBP',
        nightlyRate, totalNights, subtotal, cleaningFee, serviceFee, taxes, discount, totalAmount,
        'unpaid', data.source, data.externalId || null,
        data.guestNotes || null, data.internalNotes || null, data.specialRequests || null,
        now, now
      )
      .run();

    // Create availability block
    const blockId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO availability_blocks (id, tenant_id, unit_id, block_type, start_date, end_date, booking_id, source, created_at, updated_at)
         VALUES (?, ?, ?, 'booking', ?, ?, ?, 'api', ?, ?)`
      )
      .bind(blockId, tenantId, data.unitId, data.checkInDate, data.checkOutDate, bookingId, now, now)
      .run();

    // Update guest stats
    await db
      .prepare('UPDATE guests SET total_bookings = total_bookings + 1, updated_at = ? WHERE id = ?')
      .bind(now, guestId)
      .run();

    return success(c, {
      id: bookingId,
      bookingRef,
      status: 'pending',
      unitId: data.unitId,
      unitName: unit.name,
      propertyName: unit.property_name,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      totalNights,
      totalAmount,
      currency: unit.currency || 'GBP',
    }, 201);
  } catch (err) {
    console.error('Create booking error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to create booking', 500);
  }
});

/**
 * Update a booking
 * PATCH /bookings/:id
 */
bookingsRouter.patch('/:id', requireTenant, requirePermission('bookings:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const bookingId = c.req.param('id');

  const body = await c.req.json();
  const parsed = updateBookingSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid update data', 400, parsed.error.flatten());
  }

  try {
    // Check booking exists
    const existing = await db
      .prepare('SELECT * FROM bookings WHERE id = ? AND tenant_id = ?')
      .bind(bookingId, tenantId)
      .first<any>();

    if (!existing) {
      return notFound(c, 'Booking not found');
    }

    if (['cancelled', 'checked_out'].includes(existing.status)) {
      return error(c, 'INVALID_STATUS', 'Cannot update cancelled or completed bookings', 400);
    }

    const updates: string[] = [];
    const values: any[] = [];
    const data = parsed.data;

    if (data.checkInDate) {
      updates.push('check_in_date = ?');
      values.push(data.checkInDate);
    }
    if (data.checkOutDate) {
      updates.push('check_out_date = ?');
      values.push(data.checkOutDate);
    }
    if (data.checkInTime !== undefined) {
      updates.push('check_in_time = ?');
      values.push(data.checkInTime);
    }
    if (data.checkOutTime !== undefined) {
      updates.push('check_out_time = ?');
      values.push(data.checkOutTime);
    }
    if (data.adults !== undefined) {
      updates.push('adults = ?');
      values.push(data.adults);
    }
    if (data.children !== undefined) {
      updates.push('children = ?');
      values.push(data.children);
    }
    if (data.infants !== undefined) {
      updates.push('infants = ?');
      values.push(data.infants);
    }
    if (data.guestNotes !== undefined) {
      updates.push('guest_notes = ?');
      values.push(data.guestNotes);
    }
    if (data.internalNotes !== undefined) {
      updates.push('internal_notes = ?');
      values.push(data.internalNotes);
    }
    if (data.specialRequests !== undefined) {
      updates.push('special_requests = ?');
      values.push(data.specialRequests);
    }

    if (updates.length === 0) {
      return success(c, existing);
    }

    // Recalculate nights if dates changed
    if (data.checkInDate || data.checkOutDate) {
      const checkIn = data.checkInDate || existing.check_in_date;
      const checkOut = data.checkOutDate || existing.check_out_date;
      const totalNights = calculateNights(checkIn, checkOut);
      const subtotal = existing.nightly_rate * totalNights;
      const totalAmount = subtotal + existing.cleaning_fee + existing.service_fee + existing.taxes - existing.discount;

      updates.push('total_nights = ?', 'subtotal = ?', 'total_amount = ?');
      values.push(totalNights, subtotal, totalAmount);

      // Update availability block
      await db
        .prepare('UPDATE availability_blocks SET start_date = ?, end_date = ?, updated_at = ? WHERE booking_id = ?')
        .bind(checkIn, checkOut, Math.floor(Date.now() / 1000), bookingId)
        .run();
    }

    updates.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));
    values.push(bookingId, tenantId);

    await db
      .prepare(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`)
      .bind(...values)
      .run();

    // Fetch updated booking
    const updated = await db
      .prepare('SELECT * FROM bookings WHERE id = ?')
      .bind(bookingId)
      .first();

    return success(c, updated);
  } catch (err) {
    console.error('Update booking error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to update booking', 500);
  }
});

/**
 * Confirm a booking (after payment)
 * POST /bookings/:id/confirm
 */
bookingsRouter.post('/:id/confirm', requireTenant, requirePermission('bookings:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const bookingId = c.req.param('id');

  const body = await c.req.json();

  try {
    const booking = await db
      .prepare('SELECT * FROM bookings WHERE id = ? AND tenant_id = ?')
      .bind(bookingId, tenantId)
      .first<any>();

    if (!booking) {
      return notFound(c, 'Booking not found');
    }

    if (booking.status !== 'pending') {
      return error(c, 'INVALID_STATUS', `Cannot confirm booking with status: ${booking.status}`, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    const amountPaid = body.amountPaid || booking.total_amount;
    const paymentStatus = amountPaid >= booking.total_amount ? 'paid' : 'partial';

    await db
      .prepare(
        `UPDATE bookings
         SET status = 'confirmed', payment_status = ?, amount_paid = ?, confirmed_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(paymentStatus, amountPaid, now, now, bookingId)
      .run();

    // Update guest stats
    await db
      .prepare('UPDATE guests SET total_spent = total_spent + ?, updated_at = ? WHERE id = ?')
      .bind(amountPaid, now, booking.guest_id)
      .run();

    // Queue booking confirmation notification
    try {
      const guest = await db
        .prepare('SELECT * FROM guests WHERE id = ?')
        .bind(booking.guest_id)
        .first<any>();

      const unit = await db
        .prepare(`
          SELECT u.name as unit_name, p.name as property_name
          FROM units u
          JOIN properties p ON p.id = u.property_id
          WHERE u.id = ?
        `)
        .bind(booking.unit_id)
        .first<any>();

      if (guest?.email && unit) {
        const drizzleDb = drizzle(c.env.DB_CORE);
        await queueNotification(drizzleDb, {
          tenantId,
          type: 'email',
          recipientEmail: guest.email,
          recipientName: `${guest.first_name} ${guest.last_name}`,
          event: NotificationEvents.BOOKING_CONFIRMED,
          variables: {
            guestName: `${guest.first_name} ${guest.last_name}`,
            propertyName: unit.property_name,
            unitName: unit.unit_name,
            checkIn: new Date(booking.check_in_date).toLocaleDateString(),
            checkOut: new Date(booking.check_out_date).toLocaleDateString(),
            guests: booking.num_guests,
            totalAmount: `$${(booking.total_amount / 100).toFixed(2)}`,
            bookingNumber: booking.booking_ref,
            bookingUrl: `https://app.propflow360.com/bookings/${booking.id}`,
          },
          bookingId: booking.id,
        });
      }
    } catch (notifError) {
      console.error('Failed to queue notification:', notifError);
      // Don't fail the booking if notification fails
    }

    return success(c, {
      id: bookingId,
      status: 'confirmed',
      paymentStatus,
      amountPaid,
      confirmedAt: now,
    });
  } catch (err) {
    console.error('Confirm booking error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to confirm booking', 500);
  }
});

/**
 * Cancel a booking
 * POST /bookings/:id/cancel
 */
bookingsRouter.post('/:id/cancel', requireTenant, requirePermission('bookings:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const userId = c.get('session')?.userId;
  const bookingId = c.req.param('id');

  const body = await c.req.json();
  const parsed = cancelBookingSchema.safeParse({ ...body, bookingId });

  if (!parsed.success) {
    return error(c, 'VALIDATION_ERROR', 'Invalid cancel data', 400, parsed.error.flatten());
  }

  try {
    const booking = await db
      .prepare('SELECT * FROM bookings WHERE id = ? AND tenant_id = ?')
      .bind(bookingId, tenantId)
      .first<any>();

    if (!booking) {
      return notFound(c, 'Booking not found');
    }

    if (['cancelled', 'checked_out', 'no_show'].includes(booking.status)) {
      return error(c, 'INVALID_STATUS', `Cannot cancel booking with status: ${booking.status}`, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    const refundAmount = parsed.data.refundAmount || 0;
    const paymentStatus = refundAmount > 0 ? 'refunded' : booking.payment_status;

    await db
      .prepare(
        `UPDATE bookings
         SET status = 'cancelled', payment_status = ?, cancelled_at = ?, cancelled_by = ?,
             cancellation_reason = ?, refund_amount = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(paymentStatus, now, userId || null, parsed.data.reason || null, refundAmount, now, bookingId)
      .run();

    // Delete availability block
    await db
      .prepare('DELETE FROM availability_blocks WHERE booking_id = ?')
      .bind(bookingId)
      .run();

    return success(c, {
      id: bookingId,
      status: 'cancelled',
      cancelledAt: now,
      refundAmount,
    });
  } catch (err) {
    console.error('Cancel booking error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to cancel booking', 500);
  }
});

/**
 * Check in a guest
 * POST /bookings/:id/check-in
 */
bookingsRouter.post('/:id/check-in', requireTenant, requirePermission('bookings:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const bookingId = c.req.param('id');

  try {
    const booking = await db
      .prepare('SELECT * FROM bookings WHERE id = ? AND tenant_id = ?')
      .bind(bookingId, tenantId)
      .first<any>();

    if (!booking) {
      return notFound(c, 'Booking not found');
    }

    if (booking.status !== 'confirmed') {
      return error(c, 'INVALID_STATUS', `Cannot check in booking with status: ${booking.status}`, 400);
    }

    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare('UPDATE bookings SET status = ?, checked_in_at = ?, updated_at = ? WHERE id = ?')
      .bind('checked_in', now, now, bookingId)
      .run();

    return success(c, {
      id: bookingId,
      status: 'checked_in',
      checkedInAt: now,
    });
  } catch (err) {
    console.error('Check in error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to check in', 500);
  }
});

/**
 * Check out a guest
 * POST /bookings/:id/check-out
 */
bookingsRouter.post('/:id/check-out', requireTenant, requirePermission('bookings:write'), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId')!;
  const bookingId = c.req.param('id');

  try {
    const booking = await db
      .prepare('SELECT * FROM bookings WHERE id = ? AND tenant_id = ?')
      .bind(bookingId, tenantId)
      .first<any>();

    if (!booking) {
      return notFound(c, 'Booking not found');
    }

    if (booking.status !== 'checked_in') {
      return error(c, 'INVALID_STATUS', `Cannot check out booking with status: ${booking.status}`, 400);
    }

    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare('UPDATE bookings SET status = ?, checked_out_at = ?, updated_at = ? WHERE id = ?')
      .bind('checked_out', now, now, bookingId)
      .run();

    return success(c, {
      id: bookingId,
      status: 'checked_out',
      checkedOutAt: now,
    });
  } catch (err) {
    console.error('Check out error:', err);
    return error(c, 'INTERNAL_ERROR', 'Failed to check out', 500);
  }
});
