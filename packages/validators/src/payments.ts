import { z } from 'zod';

// Invoice types
export const invoiceTypeSchema = z.enum([
  'booking',
  'rent',
  'deposit',
  'cleaning',
  'damage',
  'other',
]);

// Invoice status
export const invoiceStatusSchema = z.enum([
  'draft',
  'sent',
  'paid',
  'partial',
  'overdue',
  'cancelled',
  'refunded',
]);

// Payment status
export const paymentStatusSchema = z.enum([
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
]);

// Payment method types
export const paymentMethodSchema = z.enum([
  'card',
  'bank_transfer',
  'cash',
  'check',
  'other',
]);

// Refund reasons
export const refundReasonSchema = z.enum([
  'requested_by_customer',
  'duplicate',
  'fraudulent',
  'cancellation',
  'other',
]);

// Line item schema
export const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().int().min(0), // in smallest currency unit
  amount: z.number().int().min(0), // quantity * unitPrice
  taxRate: z.number().int().min(0).max(10000).optional(), // percentage * 100
});

// Create invoice
export const createInvoiceSchema = z.object({
  bookingId: z.string().optional(),
  leaseId: z.string().optional(),
  guestId: z.string().min(1, 'Guest ID is required'),

  type: invoiceTypeSchema,

  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),

  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),

  taxRate: z.number().int().min(0).max(10000).optional(), // percentage * 100 (e.g., 2000 = 20%)
  taxNumber: z.string().max(50).optional(),
  discountAmount: z.number().int().min(0).optional(),
  currency: z.string().length(3).default('GBP'),

  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
}).refine(
  (data) => data.dueDate >= data.issueDate,
  { message: 'Due date must be on or after issue date', path: ['dueDate'] }
);

// Update invoice
export const updateInvoiceSchema = z.object({
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
  taxRate: z.number().int().min(0).max(10000).optional(),
  taxNumber: z.string().max(50).optional().nullable(),
  discountAmount: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional().nullable(),
  internalNotes: z.string().max(2000).optional().nullable(),
});

// Send invoice
export const sendInvoiceSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  sendEmail: z.boolean().default(true),
  emailAddress: z.string().email().optional(),
});

// Create payment intent (for client-side payment)
export const createPaymentIntentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amount: z.number().int().min(1, 'Amount must be at least 1').optional(), // partial payment
  returnUrl: z.string().url().optional(),
});

// Record manual payment
export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amount: z.number().int().min(1, 'Amount must be at least 1'),
  paymentMethod: paymentMethodSchema,
  notes: z.string().max(500).optional(),
  processedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Create refund
export const createRefundSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  amount: z.number().int().min(1).optional(), // partial refund
  reason: refundReasonSchema,
  description: z.string().max(500).optional(),
});

// List invoices
export const listInvoicesSchema = z.object({
  bookingId: z.string().optional(),
  leaseId: z.string().optional(),
  guestId: z.string().optional(),
  type: invoiceTypeSchema.optional(),
  status: invoiceStatusSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  overdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// List payments
export const listPaymentsSchema = z.object({
  invoiceId: z.string().optional(),
  status: paymentStatusSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Configure payment provider
export const configureProviderSchema = z.object({
  provider: z.enum(['stripe', 'adyen']),
  isDefault: z.boolean().default(false),
  config: z.object({
    apiKey: z.string().min(1, 'API key is required'),
    webhookSecret: z.string().min(1, 'Webhook secret is required'),
    publishableKey: z.string().optional(), // Stripe
    merchantAccount: z.string().optional(), // Adyen
    clientKey: z.string().optional(), // Adyen
    environment: z.enum(['test', 'live']).default('test'),
  }),
  supportedCurrencies: z.array(z.string().length(3)).optional(),
});

// Type exports
export type InvoiceType = z.infer<typeof invoiceTypeSchema>;
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type RefundReason = z.infer<typeof refundReasonSchema>;
export type LineItem = z.infer<typeof lineItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type SendInvoiceInput = z.infer<typeof sendInvoiceSchema>;
export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;
export type ListPaymentsInput = z.infer<typeof listPaymentsSchema>;
export type ConfigureProviderInput = z.infer<typeof configureProviderSchema>;
