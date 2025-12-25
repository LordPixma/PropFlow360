import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { bookings, leases, guests } from './bookings';

// Payment provider configuration per tenant
export const paymentProviders = sqliteTable(
  'payment_providers',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Provider type: 'stripe' | 'adyen'
    provider: text('provider').notNull(),

    // Is this the default provider for the tenant?
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),

    // Provider-specific configuration (encrypted in practice)
    // Stripe: { accountId, secretKey, publishableKey, webhookSecret }
    // Adyen: { merchantAccount, apiKey, clientKey, webhookHmac }
    config: text('config', { mode: 'json' }).notNull(),

    // For marketplace/connect features
    // Stripe Connect account ID or Adyen sub-merchant
    platformAccountId: text('platform_account_id'),

    // Provider status
    status: text('status').notNull().default('active'), // active, suspended, disconnected

    // Supported currencies
    supportedCurrencies: text('supported_currencies', { mode: 'json' }).$type<string[]>(),

    // Metadata
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('payment_providers_tenant_idx').on(table.tenantId),
    tenantDefaultIdx: index('payment_providers_tenant_default_idx').on(table.tenantId, table.isDefault),
  })
);

// Invoices for bookings and leases
export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Invoice number (tenant-specific sequence)
    invoiceNumber: text('invoice_number').notNull(),

    // Associated entity
    bookingId: text('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
    leaseId: text('lease_id').references(() => leases.id, { onDelete: 'set null' }),
    guestId: text('guest_id')
      .notNull()
      .references(() => guests.id, { onDelete: 'restrict' }),

    // Invoice type
    type: text('type').notNull(), // booking, rent, deposit, cleaning, damage, other

    // Status
    status: text('status').notNull().default('draft'), // draft, sent, paid, partial, overdue, cancelled, refunded

    // Dates
    issueDate: text('issue_date').notNull(),
    dueDate: text('due_date').notNull(),
    paidDate: text('paid_date'),

    // Amounts (in smallest currency unit, e.g., cents/pence)
    subtotal: integer('subtotal').notNull(), // Before tax
    taxAmount: integer('tax_amount').notNull().default(0),
    discountAmount: integer('discount_amount').notNull().default(0),
    totalAmount: integer('total_amount').notNull(),
    paidAmount: integer('paid_amount').notNull().default(0),
    currency: text('currency').notNull().default('GBP'),

    // Line items stored as JSON
    // [{ description, quantity, unitPrice, amount, taxRate }]
    lineItems: text('line_items', { mode: 'json' }).$type<InvoiceLineItem[]>(),

    // Tax information
    taxRate: integer('tax_rate'), // Percentage * 100 (e.g., 2000 = 20%)
    taxNumber: text('tax_number'), // VAT number if applicable

    // Notes
    notes: text('notes'),
    internalNotes: text('internal_notes'),

    // PDF storage
    pdfUrl: text('pdf_url'),

    // Metadata
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('invoices_tenant_idx').on(table.tenantId),
    tenantNumberIdx: index('invoices_tenant_number_idx').on(table.tenantId, table.invoiceNumber),
    bookingIdx: index('invoices_booking_idx').on(table.bookingId),
    leaseIdx: index('invoices_lease_idx').on(table.leaseId),
    guestIdx: index('invoices_guest_idx').on(table.guestId),
    statusIdx: index('invoices_status_idx').on(table.tenantId, table.status),
    dueDateIdx: index('invoices_due_date_idx').on(table.tenantId, table.dueDate),
  })
);

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
}

// Payments received
export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Associated invoice
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'restrict' }),

    // Payment provider used
    providerId: text('provider_id')
      .references(() => paymentProviders.id, { onDelete: 'set null' }),

    // Provider-specific IDs
    providerPaymentId: text('provider_payment_id'), // Stripe PaymentIntent ID, Adyen pspReference
    providerChargeId: text('provider_charge_id'), // Stripe Charge ID if applicable

    // Payment method info
    paymentMethod: text('payment_method').notNull(), // card, bank_transfer, cash, check, other
    paymentMethodDetails: text('payment_method_details', { mode: 'json' }), // Last 4 digits, card brand, etc.

    // Status
    status: text('status').notNull().default('pending'), // pending, processing, succeeded, failed, cancelled, refunded

    // Amount
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('GBP'),

    // Fees (for marketplace/connect)
    platformFee: integer('platform_fee').default(0),
    processingFee: integer('processing_fee').default(0),
    netAmount: integer('net_amount'), // Amount after fees

    // Failure info
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),

    // Timestamps
    processedAt: text('processed_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('payments_tenant_idx').on(table.tenantId),
    invoiceIdx: index('payments_invoice_idx').on(table.invoiceId),
    providerPaymentIdx: index('payments_provider_payment_idx').on(table.providerPaymentId),
    statusIdx: index('payments_status_idx').on(table.tenantId, table.status),
  })
);

// Refunds issued
export const refunds = sqliteTable(
  'refunds',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Associated payment
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),

    // Provider-specific refund ID
    providerRefundId: text('provider_refund_id'),

    // Status
    status: text('status').notNull().default('pending'), // pending, processing, succeeded, failed, cancelled

    // Amount
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('GBP'),

    // Reason
    reason: text('reason').notNull(), // requested_by_customer, duplicate, fraudulent, cancellation, other
    description: text('description'),

    // Failure info
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),

    // Timestamps
    processedAt: text('processed_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('refunds_tenant_idx').on(table.tenantId),
    paymentIdx: index('refunds_payment_idx').on(table.paymentId),
    providerRefundIdx: index('refunds_provider_refund_idx').on(table.providerRefundId),
    statusIdx: index('refunds_status_idx').on(table.tenantId, table.status),
  })
);

// Payouts to property owners (for marketplace)
export const payouts = sqliteTable(
  'payouts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Provider-specific payout ID
    providerPayoutId: text('provider_payout_id'),

    // Recipient (Connect account or sub-merchant)
    recipientAccountId: text('recipient_account_id').notNull(),

    // Status
    status: text('status').notNull().default('pending'), // pending, in_transit, paid, failed, cancelled

    // Amount
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('GBP'),

    // Bank account info (masked)
    bankAccountLast4: text('bank_account_last4'),
    bankName: text('bank_name'),

    // Period covered
    periodStart: text('period_start'),
    periodEnd: text('period_end'),

    // Description
    description: text('description'),

    // Failure info
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),

    // Timestamps
    arrivalDate: text('arrival_date'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    tenantIdx: index('payouts_tenant_idx').on(table.tenantId),
    providerPayoutIdx: index('payouts_provider_payout_idx').on(table.providerPayoutId),
    recipientIdx: index('payouts_recipient_idx').on(table.recipientAccountId),
    statusIdx: index('payouts_status_idx').on(table.tenantId, table.status),
  })
);

// Webhook events for idempotency and debugging
export const webhookEvents = sqliteTable(
  'webhook_events',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Provider info
    provider: text('provider').notNull(), // stripe, adyen
    eventId: text('event_id').notNull(), // Provider's event ID
    eventType: text('event_type').notNull(), // payment_intent.succeeded, AUTHORISATION, etc.

    // Processing status
    status: text('status').notNull().default('pending'), // pending, processing, processed, failed, skipped

    // Raw payload (for debugging)
    payload: text('payload', { mode: 'json' }),

    // Processing result
    processedAt: text('processed_at'),
    errorMessage: text('error_message'),

    // Timestamps
    receivedAt: text('received_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    providerEventIdx: index('webhook_events_provider_event_idx').on(table.provider, table.eventId),
    statusIdx: index('webhook_events_status_idx').on(table.status),
    receivedAtIdx: index('webhook_events_received_at_idx').on(table.receivedAt),
  })
);

// Type exports
export type PaymentProvider = typeof paymentProviders.$inferSelect;
export type NewPaymentProvider = typeof paymentProviders.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
