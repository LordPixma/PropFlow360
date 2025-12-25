import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const tenants = sqliteTable(
  'tenants',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    plan: text('plan', { enum: ['starter', 'professional', 'enterprise'] })
      .notNull()
      .default('starter'),
    status: text('status', { enum: ['active', 'suspended', 'cancelled'] })
      .notNull()
      .default('active'),
    settings: text('settings', { mode: 'json' }).$type<TenantSettings>(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [uniqueIndex('idx_tenants_slug').on(table.slug)]
);

export const tenantMemberships = sqliteTable(
  'tenant_memberships',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    role: text('role', { enum: ['owner', 'manager', 'finance', 'ops', 'readonly'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_tenant_memberships_tenant').on(table.tenantId),
    index('idx_tenant_memberships_user').on(table.userId),
    uniqueIndex('idx_tenant_memberships_unique').on(table.tenantId, table.userId),
  ]
);

export interface TenantSettings {
  timezone?: string;
  currency?: string;
  locale?: string;
  checkInTime?: string;
  checkOutTime?: string;
  branding?: {
    logo?: string;
    primaryColor?: string;
    accentColor?: string;
  };
}

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type NewTenantMembership = typeof tenantMemberships.$inferInsert;
