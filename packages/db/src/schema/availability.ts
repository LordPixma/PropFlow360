import { sql } from 'drizzle-orm';
import { text, integer, real, sqliteTable, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { units } from './units';

/**
 * Availability blocks represent periods where a unit is unavailable
 * Types:
 * - booking: Unit is booked by a guest
 * - hold: Temporary hold during booking process (expires after TTL)
 * - blocked: Manually blocked by owner/manager
 * - maintenance: Under maintenance
 * - owner_use: Reserved for owner use
 */
export const availabilityBlocks = sqliteTable(
  'availability_blocks',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),

    // Block type
    blockType: text('block_type', {
      enum: ['booking', 'hold', 'blocked', 'maintenance', 'owner_use'],
    }).notNull(),

    // Date range (stored as YYYY-MM-DD strings for easy querying)
    startDate: text('start_date').notNull(), // Check-in date
    endDate: text('end_date').notNull(), // Check-out date (exclusive)

    // Reference to booking if type is 'booking'
    bookingId: text('booking_id'),

    // Hold-specific fields
    holdToken: text('hold_token'), // Unique token for hold validation
    holdExpiresAt: integer('hold_expires_at'), // Unix timestamp when hold expires

    // Optional notes
    notes: text('notes'),

    // Source of the block (manual, api, channel_sync, etc.)
    source: text('source').default('manual'),
    externalId: text('external_id'), // ID from external system (channel manager)

    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    tenantIdx: index('idx_availability_blocks_tenant').on(table.tenantId),
    unitIdx: index('idx_availability_blocks_unit').on(table.unitId),
    // Composite index for date range queries
    unitDatesIdx: index('idx_availability_blocks_unit_dates').on(
      table.unitId,
      table.startDate,
      table.endDate
    ),
    // Index for finding expired holds
    holdExpiresIdx: index('idx_availability_blocks_hold_expires').on(
      table.blockType,
      table.holdExpiresAt
    ),
    // Index for booking lookup
    bookingIdx: index('idx_availability_blocks_booking').on(table.bookingId),
    // Unique hold token
    holdTokenIdx: uniqueIndex('idx_availability_blocks_hold_token').on(table.holdToken),
  })
);

/**
 * Calendar sync status for external calendars (iCal imports)
 */
export const calendarSyncs = sqliteTable(
  'calendar_syncs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),

    // Calendar source
    name: text('name').notNull(), // Display name (e.g., "Airbnb Calendar")
    icsUrl: text('ics_url').notNull(), // URL to fetch iCal feed

    // Sync settings
    syncDirection: text('sync_direction', {
      enum: ['import', 'export', 'both'],
    })
      .notNull()
      .default('import'),
    syncIntervalMinutes: integer('sync_interval_minutes').default(60),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),

    // Last sync status
    lastSyncAt: integer('last_sync_at'),
    lastSyncStatus: text('last_sync_status', {
      enum: ['success', 'error', 'pending'],
    }),
    lastSyncError: text('last_sync_error'),
    lastSyncEventsCount: integer('last_sync_events_count'),

    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    tenantIdx: index('idx_calendar_syncs_tenant').on(table.tenantId),
    unitIdx: index('idx_calendar_syncs_unit').on(table.unitId),
    activeIdx: index('idx_calendar_syncs_active').on(table.isActive, table.lastSyncAt),
  })
);

// Type exports
export type AvailabilityBlock = typeof availabilityBlocks.$inferSelect;
export type NewAvailabilityBlock = typeof availabilityBlocks.$inferInsert;
export type CalendarSync = typeof calendarSyncs.$inferSelect;
export type NewCalendarSync = typeof calendarSyncs.$inferInsert;

export type BlockType = 'booking' | 'hold' | 'blocked' | 'maintenance' | 'owner_use';
export type SyncDirection = 'import' | 'export' | 'both';
export type SyncStatus = 'success' | 'error' | 'pending';
