/**
 * Admin & System Schema
 *
 * Tenant settings, audit logs, system health, and administrative features
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { users } from './users';

/**
 * Tenant Settings
 * Configuration and preferences per tenant
 */
export const tenantSettings = sqliteTable('tenant_settings', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Business Information
  businessName: text('business_name'),
  businessEmail: text('business_email'),
  businessPhone: text('business_phone'),
  businessAddress: text('business_address', { mode: 'json' }).$type<{
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  }>(),
  website: text('website'),
  logo: text('logo'), // URL to logo
  timezone: text('timezone').default('UTC'),
  currency: text('currency').default('USD'),
  locale: text('locale').default('en-US'),

  // Feature Flags
  features: text('features', { mode: 'json' }).$type<{
    bookingsEnabled?: boolean;
    leasesEnabled?: boolean;
    paymentsEnabled?: boolean;
    maintenanceEnabled?: boolean;
    channelManagerEnabled?: boolean;
    analyticsEnabled?: boolean;
    notificationsEnabled?: boolean;
  }>(),

  // Payment Settings
  paymentSettings: text('payment_settings', { mode: 'json' }).$type<{
    defaultPaymentProvider?: string; // stripe, adyen
    stripeConnected?: boolean;
    adyenConnected?: boolean;
    acceptedPaymentMethods?: string[];
    defaultCurrency?: string;
    taxRate?: number; // Percentage
    lateFeeEnabled?: boolean;
    lateFeeAmount?: number; // In cents
    lateFeeDays?: number;
  }>(),

  // Booking Settings
  bookingSettings: text('booking_settings', { mode: 'json' }).$type<{
    defaultCheckInTime?: string; // HH:mm
    defaultCheckOutTime?: string; // HH:mm
    minAdvanceBooking?: number; // Hours
    maxAdvanceBooking?: number; // Days
    instantBookingEnabled?: boolean;
    requireApproval?: boolean;
    bufferDays?: number; // Days between bookings
    defaultCancellationPolicy?: string;
  }>(),

  // Notification Settings
  notificationSettings: text('notification_settings', { mode: 'json' }).$type<{
    emailFromName?: string;
    emailFromAddress?: string;
    smsFromNumber?: string;
    bookingConfirmationEnabled?: boolean;
    paymentReceiptEnabled?: boolean;
    checkInReminderEnabled?: boolean;
    checkInReminderDays?: number;
    reviewRequestEnabled?: boolean;
    reviewRequestDays?: number;
  }>(),

  // Maintenance Settings
  maintenanceSettings: text('maintenance_settings', { mode: 'json' }).$type<{
    autoAssignEnabled?: boolean;
    priorityLevels?: string[];
    categories?: string[];
    slaEnabled?: boolean;
    slaHours?: Record<string, number>; // priority -> hours
  }>(),

  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Audit Logs
 * Track all significant actions for compliance and debugging
 */
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

  // Action details
  action: text('action').notNull(), // create, update, delete, login, etc.
  resource: text('resource').notNull(), // booking, payment, property, etc.
  resourceId: text('resource_id'), // ID of affected resource

  // Change tracking
  changes: text('changes', { mode: 'json' }).$type<{
    before?: Record<string, any>;
    after?: Record<string, any>;
    fields?: string[];
  }>(),

  // Request context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  requestId: text('request_id'),

  // Metadata
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  severity: text('severity').default('info'), // debug, info, warning, error, critical

  createdAt: text('created_at').notNull(),
});

/**
 * System Health Metrics
 * Track system health and performance
 */
export const systemHealth = sqliteTable('system_health', {
  id: text('id').primaryKey(),
  timestamp: text('timestamp').notNull(),

  // Service health
  service: text('service').notNull(), // api, worker-notify, worker-analytics, etc.
  status: text('status').notNull(), // healthy, degraded, down

  // Performance metrics
  responseTime: integer('response_time'), // Milliseconds
  errorRate: integer('error_rate'), // Percentage * 100
  requestCount: integer('request_count'),

  // Resource usage
  memoryUsage: integer('memory_usage'), // MB
  cpuUsage: integer('cpu_usage'), // Percentage * 100

  // Error details
  lastError: text('last_error'),
  errorCount: integer('error_count').default(0),

  // Metadata
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),

  createdAt: text('created_at').notNull(),
});

/**
 * Feature Flags
 * Global and tenant-specific feature flags
 */
export const featureFlags = sqliteTable('feature_flags', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // NULL = global

  // Flag details
  key: text('key').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  enabled: integer('enabled').notNull().default(0),

  // Rollout config
  rolloutPercentage: integer('rollout_percentage').default(100), // 0-100
  targetUsers: text('target_users', { mode: 'json' }).$type<string[]>(),
  targetTenants: text('target_tenants', { mode: 'json' }).$type<string[]>(),

  // Metadata
  createdBy: text('created_by'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),

  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * API Keys
 * Programmatic access for integrations
 */
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),

  // Key details
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(), // Hashed API key
  keyPrefix: text('key_prefix').notNull(), // First 8 chars for identification

  // Permissions
  scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull(), // read:bookings, write:payments, etc.

  // Usage limits
  rateLimit: integer('rate_limit'), // Requests per hour
  usageCount: integer('usage_count').default(0),
  lastUsedAt: text('last_used_at'),

  // Status
  status: text('status').notNull().default('active'), // active, revoked, expired
  expiresAt: text('expires_at'),

  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Webhooks
 * Outgoing webhooks for integrations
 */
export const webhooks = sqliteTable('webhooks', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Webhook details
  url: text('url').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  secret: text('secret').notNull(), // For signature verification

  // Events
  events: text('events', { mode: 'json' }).$type<string[]>().notNull(), // booking.created, payment.succeeded, etc.

  // Delivery settings
  retryEnabled: integer('retry_enabled').default(1),
  maxRetries: integer('max_retries').default(3),
  timeout: integer('timeout').default(5000), // Milliseconds

  // Status
  status: text('status').notNull().default('active'), // active, paused, disabled
  lastTriggeredAt: text('last_triggered_at'),
  failureCount: integer('failure_count').default(0),
  lastError: text('last_error'),

  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Webhook Deliveries
 * Track webhook delivery attempts
 */
export const webhookDeliveries = sqliteTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Event details
  event: text('event').notNull(),
  payload: text('payload', { mode: 'json' }).$type<Record<string, any>>(),

  // Delivery details
  status: text('status').notNull(), // pending, delivered, failed
  attempts: integer('attempts').default(0),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  responseTime: integer('response_time'), // Milliseconds
  error: text('error'),

  // Timing
  scheduledAt: text('scheduled_at').notNull(),
  deliveredAt: text('delivered_at'),
  createdAt: text('created_at').notNull(),
});

export type TenantSettingsRow = typeof tenantSettings.$inferSelect;
export type NewTenantSettingsRow = typeof tenantSettings.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type SystemHealth = typeof systemHealth.$inferSelect;
export type NewSystemHealth = typeof systemHealth.$inferInsert;

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
