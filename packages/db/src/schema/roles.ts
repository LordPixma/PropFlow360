import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './users';
import { properties } from './properties';

// Custom roles per tenant (extends default roles)
export const roles = sqliteTable(
  'roles',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    permissions: text('permissions', { mode: 'json' }).$type<string[]>().notNull(),
    isSystem: integer('is_system', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('idx_roles_tenant').on(table.tenantId)]
);

// Property-level role assignments
export const userPropertyRoles = sqliteTable(
  'user_property_roles',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    role: text('role', {
      enum: ['property_manager', 'maintenance_coordinator', 'cleaner', 'front_desk', 'vendor'],
    }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_user_property_roles_tenant').on(table.tenantId),
    index('idx_user_property_roles_user').on(table.userId),
    index('idx_user_property_roles_property').on(table.propertyId),
    uniqueIndex('idx_user_property_roles_unique').on(table.tenantId, table.userId, table.propertyId),
  ]
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type UserPropertyRole = typeof userPropertyRoles.$inferSelect;
export type NewUserPropertyRole = typeof userPropertyRoles.$inferInsert;
