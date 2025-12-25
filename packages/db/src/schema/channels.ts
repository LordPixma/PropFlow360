/**
 * Channel Manager Schema
 *
 * Manages integrations with external booking platforms (Airbnb, Booking.com, etc.)
 * and iCal sync for calendar synchronization
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { properties } from './properties';
import { units } from './units';

/**
 * Channel Connections
 * Stores credentials and configuration for external channel integrations
 */
export const channelConnections = sqliteTable('channel_connections', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Channel details
  channel: text('channel').notNull(), // airbnb, booking_com, vrbo, ical
  name: text('name').notNull(), // User-friendly name
  status: text('status').notNull().default('active'), // active, paused, error, disconnected

  // Authentication
  accessToken: text('access_token'), // OAuth access token (encrypted)
  refreshToken: text('refresh_token'), // OAuth refresh token (encrypted)
  tokenExpiresAt: text('token_expires_at'), // ISO timestamp
  credentials: text('credentials', { mode: 'json' }).$type<Record<string, any>>(), // Additional credentials (encrypted)

  // Configuration
  config: text('config', { mode: 'json' }).$type<{
    autoSync?: boolean;
    syncFrequency?: number; // minutes
    importBookings?: boolean;
    exportBookings?: boolean;
    importPricing?: boolean;
    exportPricing?: boolean;
    importAvailability?: boolean;
    exportAvailability?: boolean;
    defaultCheckInTime?: string;
    defaultCheckOutTime?: string;
    bufferDays?: number;
  }>(),

  // Sync status
  lastSyncAt: text('last_sync_at'), // ISO timestamp
  lastSyncStatus: text('last_sync_status'), // success, partial, error
  lastSyncError: text('last_sync_error'),
  nextSyncAt: text('next_sync_at'), // ISO timestamp

  // Metadata
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Channel Listings
 * Maps local units to external channel listings
 */
export const channelListings = sqliteTable('channel_listings', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => channelConnections.id, { onDelete: 'cascade' }),

  // Local property/unit
  propertyId: text('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  unitId: text('unit_id').notNull().references(() => units.id, { onDelete: 'cascade' }),

  // External listing
  externalListingId: text('external_listing_id').notNull(), // Listing ID on the channel
  externalUrl: text('external_url'), // Direct link to listing

  // Status
  status: text('status').notNull().default('active'), // active, paused, unlinked
  syncEnabled: integer('sync_enabled').notNull().default(1), // 1 = enabled, 0 = disabled

  // iCal specific
  icalUrl: text('ical_url'), // For iCal subscriptions
  icalExportUrl: text('ical_export_url'), // PropFlow360 iCal export URL

  // Mapping config
  mapping: text('mapping', { mode: 'json' }).$type<{
    priceMarkup?: number; // Percentage markup/markdown
    minStay?: number;
    maxStay?: number;
    advanceNotice?: number; // Hours
    preparationTime?: number; // Hours
    customFields?: Record<string, any>;
  }>(),

  // Sync tracking
  lastImportAt: text('last_import_at'),
  lastExportAt: text('last_export_at'),

  // Metadata
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Channel Bookings
 * Stores bookings imported from external channels
 */
export const channelBookings = sqliteTable('channel_bookings', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => channelConnections.id, { onDelete: 'cascade' }),
  listingId: text('listing_id').notNull().references(() => channelListings.id, { onDelete: 'cascade' }),

  // Linked local booking (if created)
  bookingId: text('booking_id'), // References bookings.id

  // External booking details
  externalBookingId: text('external_booking_id').notNull(), // Booking ID on the channel
  externalReservationCode: text('external_reservation_code'), // Confirmation code
  externalStatus: text('external_status').notNull(), // Status from channel

  // Guest information
  guestName: text('guest_name'),
  guestEmail: text('guest_email'),
  guestPhone: text('guest_phone'),
  guestCount: integer('guest_count'),

  // Booking details
  checkInDate: text('check_in_date').notNull(), // ISO date
  checkOutDate: text('check_out_date').notNull(), // ISO date
  nights: integer('nights').notNull(),

  // Pricing (in cents)
  totalAmount: integer('total_amount'),
  hostPayout: integer('host_payout'), // Amount after channel fees
  channelFees: integer('channel_fees'),
  currency: text('currency').notNull().default('USD'),

  // Status
  status: text('status').notNull().default('pending'), // pending, imported, cancelled, failed
  importStatus: text('import_status'), // success, partial, error
  importError: text('import_error'),

  // Sync tracking
  firstSeenAt: text('first_seen_at').notNull(),
  lastSyncedAt: text('last_sync_at').notNull(),
  importedAt: text('imported_at'), // When converted to local booking

  // Raw data
  rawData: text('raw_data', { mode: 'json' }).$type<Record<string, any>>(), // Full channel response

  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Sync Logs
 * Tracks sync operations for debugging and monitoring
 */
export const channelSyncLogs = sqliteTable('channel_sync_logs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').notNull().references(() => channelConnections.id, { onDelete: 'cascade' }),

  // Sync details
  syncType: text('sync_type').notNull(), // import, export, full
  direction: text('direction').notNull(), // inbound, outbound, bidirectional
  resource: text('resource').notNull(), // bookings, availability, pricing, listings

  // Status
  status: text('status').notNull(), // success, partial, error
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),

  // Stats
  itemsProcessed: integer('items_processed').default(0),
  itemsSuccess: integer('items_success').default(0),
  itemsError: integer('items_error').default(0),
  itemsSkipped: integer('items_skipped').default(0),

  // Error tracking
  errors: text('errors', { mode: 'json' }).$type<Array<{
    item?: string;
    error: string;
    timestamp: string;
  }>>(),

  // Metadata
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: text('created_at').notNull(),
});

/**
 * iCal Calendars
 * Manages iCal feed subscriptions and exports
 */
export const icalCalendars = sqliteTable('ical_calendars', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Associated listing
  listingId: text('listing_id').references(() => channelListings.id, { onDelete: 'cascade' }),
  unitId: text('unit_id').notNull().references(() => units.id, { onDelete: 'cascade' }),

  // iCal details
  type: text('type').notNull(), // subscription (import), export
  name: text('name').notNull(),
  url: text('url').notNull(), // Import URL or export URL

  // Export-specific
  exportToken: text('export_token'), // Unique token for export URL
  includeBookings: integer('include_bookings').default(1),
  includeBlocks: integer('include_blocks').default(1),

  // Import-specific
  lastFetchedAt: text('last_fetched_at'),
  lastFetchStatus: text('last_fetch_status'),
  lastFetchError: text('last_fetch_error'),
  eventsCount: integer('events_count').default(0),

  // Sync settings
  syncEnabled: integer('sync_enabled').notNull().default(1),
  syncFrequency: integer('sync_frequency').default(60), // minutes

  // Status
  status: text('status').notNull().default('active'), // active, paused, error

  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type ChannelConnection = typeof channelConnections.$inferSelect;
export type NewChannelConnection = typeof channelConnections.$inferInsert;

export type ChannelListing = typeof channelListings.$inferSelect;
export type NewChannelListing = typeof channelListings.$inferInsert;

export type ChannelBooking = typeof channelBookings.$inferSelect;
export type NewChannelBooking = typeof channelBookings.$inferInsert;

export type ChannelSyncLog = typeof channelSyncLogs.$inferSelect;
export type NewChannelSyncLog = typeof channelSyncLogs.$inferInsert;

export type IcalCalendar = typeof icalCalendars.$inferSelect;
export type NewIcalCalendar = typeof icalCalendars.$inferInsert;
