-- Migration: 0010_admin
-- Description: Add admin, settings, and system tables

-- Tenant Settings
CREATE TABLE tenant_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_name TEXT,
  business_email TEXT,
  business_phone TEXT,
  business_address TEXT, -- JSON
  website TEXT,
  logo TEXT,
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  locale TEXT DEFAULT 'en-US',
  features TEXT, -- JSON feature flags
  payment_settings TEXT, -- JSON
  booking_settings TEXT, -- JSON
  notification_settings TEXT, -- JSON
  maintenance_settings TEXT, -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX tenant_settings_tenant_idx ON tenant_settings(tenant_id);

-- Audit Logs
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- create, update, delete, login, etc.
  resource TEXT NOT NULL, -- booking, payment, property, etc.
  resource_id TEXT,
  changes TEXT, -- JSON: before/after
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  metadata TEXT, -- JSON
  severity TEXT DEFAULT 'info', -- debug, info, warning, error, critical
  created_at TEXT NOT NULL
);

CREATE INDEX audit_logs_tenant_idx ON audit_logs(tenant_id);
CREATE INDEX audit_logs_user_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_resource_idx ON audit_logs(resource, resource_id);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at);

-- System Health Metrics
CREATE TABLE system_health (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  service TEXT NOT NULL, -- api, worker-notify, worker-analytics, etc.
  status TEXT NOT NULL, -- healthy, degraded, down
  response_time INTEGER, -- Milliseconds
  error_rate INTEGER, -- Percentage * 100
  request_count INTEGER,
  memory_usage INTEGER, -- MB
  cpu_usage INTEGER, -- Percentage * 100
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL
);

CREATE INDEX system_health_service_idx ON system_health(service);
CREATE INDEX system_health_status_idx ON system_health(status);
CREATE INDEX system_health_timestamp_idx ON system_health(timestamp);

-- Feature Flags
CREATE TABLE feature_flags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  rollout_percentage INTEGER DEFAULT 100, -- 0-100
  target_users TEXT, -- JSON array
  target_tenants TEXT, -- JSON array
  created_by TEXT,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX feature_flags_key_idx ON feature_flags(key);
CREATE INDEX feature_flags_tenant_idx ON feature_flags(tenant_id);
CREATE UNIQUE INDEX feature_flags_unique_idx ON feature_flags(key, COALESCE(tenant_id, ''));

-- API Keys
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT NOT NULL, -- JSON array
  rate_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  last_used_at TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, revoked, expired
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX api_keys_tenant_idx ON api_keys(tenant_id);
CREATE INDEX api_keys_user_idx ON api_keys(user_id);
CREATE INDEX api_keys_status_idx ON api_keys(status);
CREATE UNIQUE INDEX api_keys_hash_idx ON api_keys(key_hash);

-- Webhooks
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  secret TEXT NOT NULL,
  events TEXT NOT NULL, -- JSON array
  retry_enabled INTEGER DEFAULT 1,
  max_retries INTEGER DEFAULT 3,
  timeout INTEGER DEFAULT 5000,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, disabled
  last_triggered_at TEXT,
  failure_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX webhooks_tenant_idx ON webhooks(tenant_id);
CREATE INDEX webhooks_status_idx ON webhooks(status);

-- Webhook Deliveries
CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload TEXT, -- JSON
  status TEXT NOT NULL, -- pending, delivered, failed
  attempts INTEGER DEFAULT 0,
  response_status INTEGER,
  response_body TEXT,
  response_time INTEGER,
  error TEXT,
  scheduled_at TEXT NOT NULL,
  delivered_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX webhook_deliveries_webhook_idx ON webhook_deliveries(webhook_id);
CREATE INDEX webhook_deliveries_tenant_idx ON webhook_deliveries(tenant_id);
CREATE INDEX webhook_deliveries_status_idx ON webhook_deliveries(status);
CREATE INDEX webhook_deliveries_created_idx ON webhook_deliveries(created_at);
