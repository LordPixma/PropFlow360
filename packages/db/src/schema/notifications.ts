import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { users } from './users';

// Notification templates
export const notificationTemplates = sqliteTable(
  'notification_templates',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Template info
    name: text('name').notNull(),
    description: text('description'),
    type: text('type').notNull(), // email, sms, both

    // Event trigger
    event: text('event').notNull(), // booking_confirmed, payment_received, cleaning_assigned, etc.

    // Email template
    emailSubject: text('email_subject'),
    emailBody: text('email_body'), // HTML content with variable placeholders
    emailTemplate: text('email_template'), // React Email template name

    // SMS template
    smsBody: text('sms_body'), // Plain text with variable placeholders

    // Status
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    isDefault: integer('is_default', { mode: 'boolean' }).default(false), // System default

    // Metadata
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('notification_templates_tenant_idx').on(table.tenantId),
    tenantEventIdx: index('notification_templates_tenant_event_idx').on(table.tenantId, table.event),
  })
);

// Notifications queue/log
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Template used
    templateId: text('template_id').references(() => notificationTemplates.id, { onDelete: 'set null' }),

    // Type
    type: text('type').notNull(), // email, sms

    // Recipient
    recipientEmail: text('recipient_email'),
    recipientPhone: text('recipient_phone'),
    recipientName: text('recipient_name'),

    // Content
    subject: text('subject'), // For email
    body: text('body').notNull(), // Rendered content

    // Variables used for rendering
    variables: text('variables', { mode: 'json' }).$type<Record<string, any>>(),

    // Related entities
    bookingId: text('booking_id'),
    leaseId: text('lease_id'),
    invoiceId: text('invoice_id'),
    maintenanceTicketId: text('maintenance_ticket_id'),
    cleaningScheduleId: text('cleaning_schedule_id'),

    // Status
    status: text('status').notNull().default('pending'), // pending, sending, sent, failed

    // Scheduling
    scheduledFor: text('scheduled_for'), // ISO timestamp for delayed sending
    sentAt: text('sent_at'),

    // Provider response
    providerMessageId: text('provider_message_id'), // Resend/Twilio message ID
    providerResponse: text('provider_response', { mode: 'json' }),

    // Failure tracking
    failureReason: text('failure_reason'),
    retryCount: integer('retry_count').default(0),
    maxRetries: integer('max_retries').default(3),

    // Metadata
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('notifications_tenant_idx').on(table.tenantId),
    statusIdx: index('notifications_status_idx').on(table.status),
    scheduledForIdx: index('notifications_scheduled_for_idx').on(table.scheduledFor),
    recipientEmailIdx: index('notifications_recipient_email_idx').on(table.recipientEmail),
    bookingIdx: index('notifications_booking_idx').on(table.bookingId),
    createdAtIdx: index('notifications_created_at_idx').on(table.tenantId, table.createdAt),
  })
);

// Type exports
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
