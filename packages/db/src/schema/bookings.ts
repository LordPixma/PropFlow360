import { sql } from 'drizzle-orm';
import { text, integer, real, sqliteTable, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { users } from './users';
import { properties } from './properties';
import { units } from './units';

/**
 * Guests - People who make bookings (may or may not be registered users)
 */
export const guests = sqliteTable(
  'guests',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Basic info
    email: text('email').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),

    // Address
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    country: text('country'),

    // Linked user (if they have an account)
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

    // Notes and preferences
    notes: text('notes'),
    preferences: text('preferences'), // JSON

    // Stats
    totalBookings: integer('total_bookings').default(0),
    totalSpent: integer('total_spent').default(0), // In cents

    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    tenantIdx: index('idx_guests_tenant').on(table.tenantId),
    emailIdx: index('idx_guests_email').on(table.tenantId, table.email),
    userIdx: index('idx_guests_user').on(table.userId),
  })
);

/**
 * Bookings - Short/medium term reservations
 */
export const bookings = sqliteTable(
  'bookings',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    guestId: text('guest_id')
      .notNull()
      .references(() => guests.id, { onDelete: 'restrict' }),

    // Booking reference (human-readable)
    bookingRef: text('booking_ref').notNull(),

    // Dates
    checkInDate: text('check_in_date').notNull(), // YYYY-MM-DD
    checkOutDate: text('check_out_date').notNull(), // YYYY-MM-DD
    checkInTime: text('check_in_time'), // HH:MM (override property default)
    checkOutTime: text('check_out_time'), // HH:MM

    // Guest count
    adults: integer('adults').notNull().default(1),
    children: integer('children').default(0),
    infants: integer('infants').default(0),

    // Status
    status: text('status', {
      enum: [
        'pending', // Awaiting payment
        'confirmed', // Paid and confirmed
        'checked_in', // Guest has arrived
        'checked_out', // Guest has left
        'cancelled', // Cancelled by guest/host
        'no_show', // Guest didn't show up
      ],
    })
      .notNull()
      .default('pending'),

    // Pricing (all in cents)
    currency: text('currency').default('GBP'),
    nightlyRate: integer('nightly_rate').notNull(), // Base rate per night
    totalNights: integer('total_nights').notNull(),
    subtotal: integer('subtotal').notNull(), // nights * rate
    cleaningFee: integer('cleaning_fee').default(0),
    serviceFee: integer('service_fee').default(0),
    taxes: integer('taxes').default(0),
    discount: integer('discount').default(0),
    totalAmount: integer('total_amount').notNull(),

    // Payment
    amountPaid: integer('amount_paid').default(0),
    paymentStatus: text('payment_status', {
      enum: ['unpaid', 'partial', 'paid', 'refunded', 'failed'],
    })
      .notNull()
      .default('unpaid'),

    // Source
    source: text('source', {
      enum: ['direct', 'airbnb', 'booking_com', 'vrbo', 'expedia', 'other'],
    })
      .notNull()
      .default('direct'),
    externalId: text('external_id'), // ID from channel

    // Special requests and notes
    guestNotes: text('guest_notes'),
    internalNotes: text('internal_notes'),
    specialRequests: text('special_requests'),

    // Cancellation
    cancelledAt: integer('cancelled_at'),
    cancelledBy: text('cancelled_by'),
    cancellationReason: text('cancellation_reason'),
    refundAmount: integer('refund_amount'),

    // Timestamps
    confirmedAt: integer('confirmed_at'),
    checkedInAt: integer('checked_in_at'),
    checkedOutAt: integer('checked_out_at'),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    tenantIdx: index('idx_bookings_tenant').on(table.tenantId),
    propertyIdx: index('idx_bookings_property').on(table.propertyId),
    unitIdx: index('idx_bookings_unit').on(table.unitId),
    guestIdx: index('idx_bookings_guest').on(table.guestId),
    statusIdx: index('idx_bookings_status').on(table.tenantId, table.status),
    datesIdx: index('idx_bookings_dates').on(table.unitId, table.checkInDate, table.checkOutDate),
    refIdx: uniqueIndex('idx_bookings_ref').on(table.tenantId, table.bookingRef),
    externalIdx: index('idx_bookings_external').on(table.source, table.externalId),
  })
);

/**
 * Leases - Long-term rental agreements
 */
export const leases = sqliteTable(
  'leases',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    guestId: text('guest_id')
      .notNull()
      .references(() => guests.id, { onDelete: 'restrict' }),

    // Lease reference
    leaseRef: text('lease_ref').notNull(),

    // Lease term
    startDate: text('start_date').notNull(), // YYYY-MM-DD
    endDate: text('end_date').notNull(), // YYYY-MM-DD
    leaseType: text('lease_type', {
      enum: ['fixed', 'month_to_month', 'periodic'],
    })
      .notNull()
      .default('fixed'),

    // Status
    status: text('status', {
      enum: ['draft', 'pending_signature', 'active', 'expired', 'terminated', 'renewed'],
    })
      .notNull()
      .default('draft'),

    // Rent details (all in cents)
    currency: text('currency').default('GBP'),
    monthlyRent: integer('monthly_rent').notNull(),
    deposit: integer('deposit').default(0),
    depositStatus: text('deposit_status', {
      enum: ['pending', 'held', 'partially_returned', 'returned', 'forfeited'],
    }).default('pending'),

    // Payment schedule
    rentDueDay: integer('rent_due_day').default(1), // Day of month rent is due
    paymentFrequency: text('payment_frequency', {
      enum: ['weekly', 'fortnightly', 'monthly', 'quarterly'],
    })
      .notNull()
      .default('monthly'),

    // Occupants
    primaryOccupant: text('primary_occupant').notNull(), // Name
    additionalOccupants: text('additional_occupants'), // JSON array

    // Terms
    noticePeriodDays: integer('notice_period_days').default(30),
    breakClauseDate: text('break_clause_date'),
    specialTerms: text('special_terms'),

    // Documents
    agreementDocUrl: text('agreement_doc_url'),
    signedAt: integer('signed_at'),
    signedByTenant: text('signed_by_tenant'),
    signedByLandlord: text('signed_by_landlord'),

    // Termination
    terminatedAt: integer('terminated_at'),
    terminationReason: text('termination_reason'),
    terminatedBy: text('terminated_by'),

    // Notes
    internalNotes: text('internal_notes'),

    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    tenantIdx: index('idx_leases_tenant').on(table.tenantId),
    propertyIdx: index('idx_leases_property').on(table.propertyId),
    unitIdx: index('idx_leases_unit').on(table.unitId),
    guestIdx: index('idx_leases_guest').on(table.guestId),
    statusIdx: index('idx_leases_status').on(table.tenantId, table.status),
    datesIdx: index('idx_leases_dates').on(table.unitId, table.startDate, table.endDate),
    refIdx: uniqueIndex('idx_leases_ref').on(table.tenantId, table.leaseRef),
  })
);

/**
 * Lease rent schedule - Individual rent payments due
 */
export const leaseRentSchedule = sqliteTable(
  'lease_rent_schedule',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    leaseId: text('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),

    // Schedule
    dueDate: text('due_date').notNull(), // YYYY-MM-DD
    periodStart: text('period_start').notNull(),
    periodEnd: text('period_end').notNull(),

    // Amount
    amount: integer('amount').notNull(), // In cents
    currency: text('currency').default('GBP'),

    // Payment status
    status: text('status', {
      enum: ['scheduled', 'pending', 'paid', 'partial', 'overdue', 'waived'],
    })
      .notNull()
      .default('scheduled'),

    paidAmount: integer('paid_amount').default(0),
    paidAt: integer('paid_at'),
    paymentId: text('payment_id'), // Reference to payment record

    // Reminders
    reminderSentAt: integer('reminder_sent_at'),
    overdueSentAt: integer('overdue_sent_at'),

    notes: text('notes'),

    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    tenantIdx: index('idx_lease_rent_schedule_tenant').on(table.tenantId),
    leaseIdx: index('idx_lease_rent_schedule_lease').on(table.leaseId),
    dueDateIdx: index('idx_lease_rent_schedule_due').on(table.tenantId, table.dueDate),
    statusIdx: index('idx_lease_rent_schedule_status').on(table.leaseId, table.status),
  })
);

// Type exports
export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Lease = typeof leases.$inferSelect;
export type NewLease = typeof leases.$inferInsert;
export type LeaseRentSchedule = typeof leaseRentSchedule.$inferSelect;
export type NewLeaseRentSchedule = typeof leaseRentSchedule.$inferInsert;

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded' | 'failed';
export type BookingSource = 'direct' | 'airbnb' | 'booking_com' | 'vrbo' | 'expedia' | 'other';
export type LeaseStatus = 'draft' | 'pending_signature' | 'active' | 'expired' | 'terminated' | 'renewed';
export type LeaseType = 'fixed' | 'month_to_month' | 'periodic';
export type RentScheduleStatus = 'scheduled' | 'pending' | 'paid' | 'partial' | 'overdue' | 'waived';
