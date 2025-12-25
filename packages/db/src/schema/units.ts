import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { properties } from './properties';

export const units = sqliteTable(
  'units',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['room', 'apartment', 'studio', 'office', 'entire_property', 'suite', 'villa'],
    }).notNull(),
    description: text('description'),

    // Capacity
    maxGuests: integer('max_guests').default(2),
    bedrooms: integer('bedrooms').default(1),
    beds: integer('beds').default(1),
    bathrooms: real('bathrooms').default(1),

    // Size
    sizeSqm: real('size_sqm'),
    floor: integer('floor'),

    // Amenities (JSON array)
    amenities: text('amenities', { mode: 'json' }).$type<string[]>(),

    // Status
    status: text('status', { enum: ['active', 'inactive', 'maintenance', 'archived'] })
      .notNull()
      .default('active'),

    // ICS calendar token for external sync
    icsToken: text('ics_token'),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_units_tenant').on(table.tenantId),
    index('idx_units_property').on(table.propertyId),
    index('idx_units_status').on(table.tenantId, table.status),
  ]
);

export const unitPricing = sqliteTable(
  'unit_pricing',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),

    name: text('name').notNull(), // 'default', 'weekend', 'summer', 'christmas'
    priceType: text('price_type', { enum: ['nightly', 'weekly', 'monthly'] }).notNull(),
    basePrice: integer('base_price').notNull(), // in smallest currency unit (pence)

    // Stay constraints
    minStay: integer('min_stay').default(1),
    maxStay: integer('max_stay'),

    // Date range for seasonal pricing
    dateFrom: text('date_from'), // YYYY-MM-DD
    dateTo: text('date_to'),

    // Day-specific pricing (JSON array of day numbers 0-6)
    daysOfWeek: text('days_of_week', { mode: 'json' }).$type<number[]>(),

    // Priority (higher = takes precedence)
    priority: integer('priority').default(0),

    // Active flag
    isActive: integer('is_active', { mode: 'boolean' }).default(true),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_unit_pricing_unit').on(table.unitId),
    index('idx_unit_pricing_dates').on(table.unitId, table.dateFrom, table.dateTo),
  ]
);

export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
export type UnitPricing = typeof unitPricing.$inferSelect;
export type NewUnitPricing = typeof unitPricing.$inferInsert;
