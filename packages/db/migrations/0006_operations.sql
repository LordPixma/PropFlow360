-- Migration: 0006_operations
-- Description: Add operations tables for maintenance and cleaning

-- Vendors table
CREATE TABLE vendors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- cleaning, maintenance, plumbing, electrical, landscaping, other
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  service_areas TEXT, -- JSON array of property IDs
  specialties TEXT, -- JSON array of specialties
  hourly_rate INTEGER, -- In smallest currency unit
  currency TEXT DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive
  rating INTEGER, -- 1-5 stars * 100
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX vendors_tenant_idx ON vendors(tenant_id);
CREATE INDEX vendors_type_idx ON vendors(tenant_id, type);
CREATE INDEX vendors_status_idx ON vendors(tenant_id, status);

-- Maintenance tickets table
CREATE TABLE maintenance_tickets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  unit_id TEXT REFERENCES units(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- plumbing, electrical, hvac, appliance, structural, pest, other
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
  status TEXT NOT NULL DEFAULT 'open', -- open, assigned, in_progress, on_hold, resolved, closed
  assigned_to_vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  assigned_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TEXT,
  reported_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reported_by_guest TEXT,
  reported_by_email TEXT,
  scheduled_date TEXT,
  due_date TEXT,
  completed_at TEXT,
  estimated_cost INTEGER,
  actual_cost INTEGER,
  currency TEXT DEFAULT 'GBP',
  image_urls TEXT, -- JSON array
  internal_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX maintenance_tickets_tenant_idx ON maintenance_tickets(tenant_id);
CREATE UNIQUE INDEX maintenance_tickets_tenant_number_idx ON maintenance_tickets(tenant_id, ticket_number);
CREATE INDEX maintenance_tickets_property_idx ON maintenance_tickets(property_id);
CREATE INDEX maintenance_tickets_unit_idx ON maintenance_tickets(unit_id);
CREATE INDEX maintenance_tickets_status_idx ON maintenance_tickets(tenant_id, status);
CREATE INDEX maintenance_tickets_priority_idx ON maintenance_tickets(tenant_id, priority);
CREATE INDEX maintenance_tickets_assigned_vendor_idx ON maintenance_tickets(assigned_to_vendor_id);

-- Maintenance comments table
CREATE TABLE maintenance_comments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id TEXT NOT NULL REFERENCES maintenance_tickets(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0, -- Boolean: hidden from vendors/guests
  status_change TEXT, -- E.g., "open → assigned"
  image_urls TEXT, -- JSON array
  created_at TEXT NOT NULL
);

CREATE INDEX maintenance_comments_tenant_idx ON maintenance_comments(tenant_id);
CREATE INDEX maintenance_comments_ticket_idx ON maintenance_comments(ticket_id);
CREATE INDEX maintenance_comments_created_at_idx ON maintenance_comments(ticket_id, created_at);

-- Cleaning schedules table
CREATE TABLE cleaning_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- checkout_clean, turnaround, deep_clean, inspection, maintenance_clean
  booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  checkout_date TEXT,
  next_checkin_date TEXT,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT, -- HH:MM format
  estimated_duration INTEGER, -- Minutes
  assigned_to_vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  assigned_at TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, assigned, in_progress, completed, cancelled
  started_at TEXT,
  completed_at TEXT,
  completed_by_vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  checklist_template_id TEXT,
  checklist_items TEXT, -- JSON array of checklist items with completion status
  issues_found TEXT,
  maintenance_tickets_created TEXT, -- JSON array of ticket IDs
  cost INTEGER,
  currency TEXT DEFAULT 'GBP',
  before_image_urls TEXT, -- JSON array
  after_image_urls TEXT, -- JSON array
  notes TEXT,
  internal_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX cleaning_schedules_tenant_idx ON cleaning_schedules(tenant_id);
CREATE INDEX cleaning_schedules_unit_idx ON cleaning_schedules(unit_id);
CREATE INDEX cleaning_schedules_booking_idx ON cleaning_schedules(booking_id);
CREATE INDEX cleaning_schedules_scheduled_date_idx ON cleaning_schedules(tenant_id, scheduled_date);
CREATE INDEX cleaning_schedules_status_idx ON cleaning_schedules(tenant_id, status);
CREATE INDEX cleaning_schedules_assigned_vendor_idx ON cleaning_schedules(assigned_to_vendor_id);

-- Cleaning checklist templates table
CREATE TABLE cleaning_checklists (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- checkout, turnaround, deep_clean, inspection
  items TEXT NOT NULL, -- JSON array of template items
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  is_default INTEGER DEFAULT 0, -- Boolean
  status TEXT NOT NULL DEFAULT 'active', -- active, archived
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX cleaning_checklists_tenant_idx ON cleaning_checklists(tenant_id);
CREATE INDEX cleaning_checklists_tenant_type_idx ON cleaning_checklists(tenant_id, type);
CREATE INDEX cleaning_checklists_property_idx ON cleaning_checklists(property_id);
