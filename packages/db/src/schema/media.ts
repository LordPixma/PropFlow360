import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { properties } from './properties';
import { units } from './units';

export const propertyMedia = sqliteTable(
  'property_media',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').references(() => properties.id, { onDelete: 'cascade' }),
    unitId: text('unit_id').references(() => units.id, { onDelete: 'cascade' }),

    type: text('type', { enum: ['photo', 'floorplan', 'video', 'document', '360_tour'] }).notNull(),
    url: text('url').notNull(), // R2 key
    thumbnailUrl: text('thumbnail_url'), // R2 key for thumbnail

    title: text('title'),
    description: text('description'),
    altText: text('alt_text'),

    // Dimensions for images
    width: integer('width'),
    height: integer('height'),
    sizeBytes: integer('size_bytes'),
    mimeType: text('mime_type'),

    // Ordering
    sortOrder: integer('sort_order').default(0),
    isCover: integer('is_cover', { mode: 'boolean' }).default(false),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_property_media_property').on(table.propertyId),
    index('idx_property_media_unit').on(table.unitId),
    index('idx_property_media_tenant').on(table.tenantId),
  ]
);

export type PropertyMedia = typeof propertyMedia.$inferSelect;
export type NewPropertyMedia = typeof propertyMedia.$inferInsert;
