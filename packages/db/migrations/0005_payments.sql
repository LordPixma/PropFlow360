-- Migration: 0005_payments
-- Description: Add payments, invoices, refunds, and payouts tables

-- Payment provider configuration per tenant
CREATE TABLE payment_providers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'stripe' | 'adyen'
  is_default INTEGER NOT NULL DEFAULT 0,
  config TEXT NOT NULL, -- JSON: provider-specific configuration
  platform_account_id TEXT, -- Stripe Connect / Adyen sub-merchant
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, disconnected
  supported_currencies TEXT, -- JSON array of currency codes
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX payment_providers_tenant_idx ON payment_providers(tenant_id);
CREATE INDEX payment_providers_tenant_default_idx ON payment_providers(tenant_id, is_default);

-- Invoices for bookings and leases
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  lease_id TEXT REFERENCES leases(id) ON DELETE SET NULL,
  guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
  type TEXT NOT NULL, -- booking, rent, deposit, cleaning, damage, other
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, paid, partial, overdue, cancelled, refunded
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  paid_date TEXT,
  subtotal INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  line_items TEXT, -- JSON array of line items
  tax_rate INTEGER, -- Percentage * 100 (e.g., 2000 = 20%)
  tax_number TEXT,
  notes TEXT,
  internal_notes TEXT,
  pdf_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX invoices_tenant_idx ON invoices(tenant_id);
CREATE UNIQUE INDEX invoices_tenant_number_idx ON invoices(tenant_id, invoice_number);
CREATE INDEX invoices_booking_idx ON invoices(booking_id);
CREATE INDEX invoices_lease_idx ON invoices(lease_id);
CREATE INDEX invoices_guest_idx ON invoices(guest_id);
CREATE INDEX invoices_status_idx ON invoices(tenant_id, status);
CREATE INDEX invoices_due_date_idx ON invoices(tenant_id, due_date);

-- Payments received
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  provider_id TEXT REFERENCES payment_providers(id) ON DELETE SET NULL,
  provider_payment_id TEXT, -- Stripe PaymentIntent ID, Adyen pspReference
  provider_charge_id TEXT, -- Stripe Charge ID
  payment_method TEXT NOT NULL, -- card, bank_transfer, cash, check, other
  payment_method_details TEXT, -- JSON: last 4 digits, card brand, etc.
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, succeeded, failed, cancelled, refunded
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  platform_fee INTEGER DEFAULT 0,
  processing_fee INTEGER DEFAULT 0,
  net_amount INTEGER,
  failure_code TEXT,
  failure_message TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX payments_tenant_idx ON payments(tenant_id);
CREATE INDEX payments_invoice_idx ON payments(invoice_id);
CREATE INDEX payments_provider_payment_idx ON payments(provider_payment_id);
CREATE INDEX payments_status_idx ON payments(tenant_id, status);

-- Refunds issued
CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  provider_refund_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, succeeded, failed, cancelled
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  reason TEXT NOT NULL, -- requested_by_customer, duplicate, fraudulent, cancellation, other
  description TEXT,
  failure_code TEXT,
  failure_message TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX refunds_tenant_idx ON refunds(tenant_id);
CREATE INDEX refunds_payment_idx ON refunds(payment_id);
CREATE INDEX refunds_provider_refund_idx ON refunds(provider_refund_id);
CREATE INDEX refunds_status_idx ON refunds(tenant_id, status);

-- Payouts to property owners (for marketplace)
CREATE TABLE payouts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_payout_id TEXT,
  recipient_account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_transit, paid, failed, cancelled
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  bank_account_last4 TEXT,
  bank_name TEXT,
  period_start TEXT,
  period_end TEXT,
  description TEXT,
  failure_code TEXT,
  failure_message TEXT,
  arrival_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX payouts_tenant_idx ON payouts(tenant_id);
CREATE INDEX payouts_provider_payout_idx ON payouts(provider_payout_id);
CREATE INDEX payouts_recipient_idx ON payouts(recipient_account_id);
CREATE INDEX payouts_status_idx ON payouts(tenant_id, status);

-- Webhook events for idempotency and debugging
CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- stripe, adyen
  event_id TEXT NOT NULL, -- Provider's event ID
  event_type TEXT NOT NULL, -- payment_intent.succeeded, AUTHORISATION, etc.
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, processed, failed, skipped
  payload TEXT, -- JSON: raw payload
  processed_at TEXT,
  error_message TEXT,
  received_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX webhook_events_provider_event_idx ON webhook_events(provider, event_id);
CREATE INDEX webhook_events_status_idx ON webhook_events(status);
CREATE INDEX webhook_events_received_at_idx ON webhook_events(received_at);
