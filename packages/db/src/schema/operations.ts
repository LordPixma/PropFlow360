import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { properties } from './properties';
import { units } from './units';
import { users } from './users';
import { bookings } from './bookings';

// Vendors (cleaners, maintenance contractors, etc.)
export const vendors = sqliteTable(
  'vendors',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Basic info
    name: text('name').notNull(),
    type: text('type').notNull(), // cleaning, maintenance, plumbing, electrical, landscaping, other
    company: text('company'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),

    // Service details
    serviceAreas: text('service_areas', { mode: 'json' }).$type<string[]>(), // Property IDs
    specialties: text('specialties', { mode: 'json' }).$type<string[]>(), // E.g., ["HVAC", "Appliance Repair"]

    // Rates
    hourlyRate: integer('hourly_rate'), // In smallest currency unit
    currency: text('currency').default('GBP'),

    // Status
    status: text('status').notNull().default('active'), // active, inactive
    rating: integer('rating'), // 1-5 stars * 100 (e.g., 450 = 4.5 stars)

    // Metadata
    notes: text('notes'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('vendors_tenant_idx').on(table.tenantId),
    typeIdx: index('vendors_type_idx').on(table.tenantId, table.type),
    statusIdx: index('vendors_status_idx').on(table.tenantId, table.status),
  })
);

// Maintenance tickets
export const maintenanceTickets = sqliteTable(
  'maintenance_tickets',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Ticket number (tenant-specific sequence)
    ticketNumber: text('ticket_number').notNull(),

    // Location
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),
    unitId: text('unit_id').references(() => units.id, { onDelete: 'set null' }),

    // Issue details
    title: text('title').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(), // plumbing, electrical, hvac, appliance, structural, pest, other
    priority: text('priority').notNull().default('medium'), // low, medium, high, urgent
    status: text('status').notNull().default('open'), // open, assigned, in_progress, on_hold, resolved, closed

    // Assignment
    assignedToVendorId: text('assigned_to_vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),
    assignedAt: text('assigned_at'),

    // Reported by
    reportedByUserId: text('reported_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    reportedByGuest: text('reported_by_guest'), // Guest name if reported by guest
    reportedByEmail: text('reported_by_email'),

    // Scheduling
    scheduledDate: text('scheduled_date'),
    dueDate: text('due_date'),
    completedAt: text('completed_at'),

    // Cost tracking
    estimatedCost: integer('estimated_cost'),
    actualCost: integer('actual_cost'),
    currency: text('currency').default('GBP'),

    // Media
    imageUrls: text('image_urls', { mode: 'json' }).$type<string[]>(),

    // Internal notes
    internalNotes: text('internal_notes'),

    // Timestamps
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('maintenance_tickets_tenant_idx').on(table.tenantId),
    tenantNumberIdx: index('maintenance_tickets_tenant_number_idx').on(table.tenantId, table.ticketNumber),
    propertyIdx: index('maintenance_tickets_property_idx').on(table.propertyId),
    unitIdx: index('maintenance_tickets_unit_idx').on(table.unitId),
    statusIdx: index('maintenance_tickets_status_idx').on(table.tenantId, table.status),
    priorityIdx: index('maintenance_tickets_priority_idx').on(table.tenantId, table.priority),
    assignedVendorIdx: index('maintenance_tickets_assigned_vendor_idx').on(table.assignedToVendorId),
  })
);

// Comments/updates on maintenance tickets
export const maintenanceComments = sqliteTable(
  'maintenance_comments',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    ticketId: text('ticket_id')
      .notNull()
      .references(() => maintenanceTickets.id, { onDelete: 'cascade' }),

    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    vendorId: text('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),

    comment: text('comment').notNull(),
    isInternal: integer('is_internal', { mode: 'boolean' }).notNull().default(false), // Hidden from vendors/guests

    // Optional status change
    statusChange: text('status_change'), // E.g., "open → assigned"

    // Media attachments
    imageUrls: text('image_urls', { mode: 'json' }).$type<string[]>(),

    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('maintenance_comments_tenant_idx').on(table.tenantId),
    ticketIdx: index('maintenance_comments_ticket_idx').on(table.ticketId),
    createdAtIdx: index('maintenance_comments_created_at_idx').on(table.ticketId, table.createdAt),
  })
);

// Cleaning schedules
export const cleaningSchedules = sqliteTable(
  'cleaning_schedules',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Location
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),

    // Type
    type: text('type').notNull(), // checkout_clean, turnaround, deep_clean, inspection, maintenance_clean

    // Associated booking (for checkout/turnaround cleans)
    bookingId: text('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    checkoutDate: text('checkout_date'),
    nextCheckinDate: text('next_checkin_date'),

    // Scheduling
    scheduledDate: text('scheduled_date').notNull(),
    scheduledTime: text('scheduled_time'), // HH:MM format
    estimatedDuration: integer('estimated_duration'), // Minutes

    // Assignment
    assignedToVendorId: text('assigned_to_vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
    assignedAt: text('assigned_at'),

    // Status
    status: text('status').notNull().default('scheduled'), // scheduled, assigned, in_progress, completed, cancelled

    // Completion
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    completedByVendorId: text('completed_by_vendor_id').references(() => vendors.id, { onDelete: 'set null' }),

    // Checklist
    checklistTemplateId: text('checklist_template_id'),
    checklistItems: text('checklist_items', { mode: 'json' }).$type<CleaningChecklistItem[]>(),

    // Issues found
    issuesFound: text('issues_found'),
    maintenanceTicketsCreated: text('maintenance_tickets_created', { mode: 'json' }).$type<string[]>(), // Ticket IDs

    // Cost
    cost: integer('cost'),
    currency: text('currency').default('GBP'),

    // Media
    beforeImageUrls: text('before_image_urls', { mode: 'json' }).$type<string[]>(),
    afterImageUrls: text('after_image_urls', { mode: 'json' }).$type<string[]>(),

    // Notes
    notes: text('notes'),
    internalNotes: text('internal_notes'),

    // Timestamps
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('cleaning_schedules_tenant_idx').on(table.tenantId),
    unitIdx: index('cleaning_schedules_unit_idx').on(table.unitId),
    bookingIdx: index('cleaning_schedules_booking_idx').on(table.bookingId),
    scheduledDateIdx: index('cleaning_schedules_scheduled_date_idx').on(table.tenantId, table.scheduledDate),
    statusIdx: index('cleaning_schedules_status_idx').on(table.tenantId, table.status),
    assignedVendorIdx: index('cleaning_schedules_assigned_vendor_idx').on(table.assignedToVendorId),
  })
);

export interface CleaningChecklistItem {
  id: string;
  area: string; // E.g., "Kitchen", "Bathroom", "Living Room"
  task: string; // E.g., "Wipe down counters", "Vacuum carpet"
  completed: boolean;
  notes?: string;
  imageUrls?: string[];
}

// Cleaning checklist templates
export const cleaningChecklists = sqliteTable(
  'cleaning_checklists',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    description: text('description'),

    // Template type
    type: text('type').notNull(), // checkout, turnaround, deep_clean, inspection

    // Checklist items (without completion status - that's in the schedule)
    items: text('items', { mode: 'json' }).$type<CleaningTemplateItem[]>().notNull(),

    // Can be property-specific or global for tenant
    propertyId: text('property_id').references(() => properties.id, { onDelete: 'cascade' }),

    // Default for this type
    isDefault: integer('is_default', { mode: 'boolean' }).default(false),

    // Status
    status: text('status').notNull().default('active'), // active, archived

    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('cleaning_checklists_tenant_idx').on(table.tenantId),
    tenantTypeIdx: index('cleaning_checklists_tenant_type_idx').on(table.tenantId, table.type),
    propertyIdx: index('cleaning_checklists_property_idx').on(table.propertyId),
  })
);

export interface CleaningTemplateItem {
  id: string;
  area: string;
  task: string;
  required?: boolean;
  estimatedMinutes?: number;
}

// Type exports
export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type MaintenanceTicket = typeof maintenanceTickets.$inferSelect;
export type NewMaintenanceTicket = typeof maintenanceTickets.$inferInsert;
export type MaintenanceComment = typeof maintenanceComments.$inferSelect;
export type NewMaintenanceComment = typeof maintenanceComments.$inferInsert;
export type CleaningSchedule = typeof cleaningSchedules.$inferSelect;
export type NewCleaningSchedule = typeof cleaningSchedules.$inferInsert;
export type CleaningChecklist = typeof cleaningChecklists.$inferSelect;
export type NewCleaningChecklist = typeof cleaningChecklists.$inferInsert;
