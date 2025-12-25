-- Migration: 0007_notifications
-- Description: Add notification templates and queue

-- Notification templates
CREATE TABLE notification_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- email, sms, both
  event TEXT NOT NULL, -- booking_confirmed, payment_received, etc.
  email_subject TEXT,
  email_body TEXT, -- HTML with variable placeholders
  email_template TEXT, -- React Email template name
  sms_body TEXT, -- Plain text with variable placeholders
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX notification_templates_tenant_idx ON notification_templates(tenant_id);
CREATE INDEX notification_templates_tenant_event_idx ON notification_templates(tenant_id, event);

-- Notifications queue/log
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES notification_templates(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- email, sms
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_name TEXT,
  subject TEXT, -- For email
  body TEXT NOT NULL, -- Rendered content
  variables TEXT, -- JSON: variables used for rendering
  booking_id TEXT,
  lease_id TEXT,
  invoice_id TEXT,
  maintenance_ticket_id TEXT,
  cleaning_schedule_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sending, sent, failed
  scheduled_for TEXT, -- ISO timestamp for delayed sending
  sent_at TEXT,
  provider_message_id TEXT, -- Resend/Twilio message ID
  provider_response TEXT, -- JSON
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX notifications_tenant_idx ON notifications(tenant_id);
CREATE INDEX notifications_status_idx ON notifications(status);
CREATE INDEX notifications_scheduled_for_idx ON notifications(scheduled_for);
CREATE INDEX notifications_recipient_email_idx ON notifications(recipient_email);
CREATE INDEX notifications_booking_idx ON notifications(booking_id);
CREATE INDEX notifications_created_at_idx ON notifications(tenant_id, created_at);
