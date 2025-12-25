import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';

export const properties = sqliteTable(
  'properties',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['residential', 'commercial', 'studio', 'mixed', 'holiday_let'],
    }).notNull(),
    description: text('description'),

    // Address
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    country: text('country').default('GB'),
    latitude: real('latitude'),
    longitude: real('longitude'),

    // Settings
    timezone: text('timezone').default('Europe/London'),
    currency: text('currency').default('GBP'),
    checkInTime: text('check_in_time').default('15:00'),
    checkOutTime: text('check_out_time').default('11:00'),

    // Status
    status: text('status', { enum: ['active', 'inactive', 'archived'] })
      .notNull()
      .default('active'),

    // Additional settings as JSON
    settings: text('settings', { mode: 'json' }).$type<PropertySettings>(),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_properties_tenant').on(table.tenantId),
    index('idx_properties_status').on(table.tenantId, table.status),
  ]
);

export interface PropertySettings {
  houseRules?: string[];
  cancellationPolicy?: 'flexible' | 'moderate' | 'strict';
  minStay?: number;
  maxStay?: number;
  instantBooking?: boolean;
  depositRequired?: boolean;
  depositPercentage?: number;
  cleaningFee?: number;
  petPolicy?: 'allowed' | 'not_allowed' | 'case_by_case';
  smokingPolicy?: 'allowed' | 'not_allowed' | 'designated_areas';
  childrenPolicy?: 'allowed' | 'not_allowed';
  eventsPolicy?: 'allowed' | 'not_allowed' | 'case_by_case';
}

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
