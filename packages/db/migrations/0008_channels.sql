-- Migration: 0008_channels
-- Description: Add channel manager tables for external platform integrations

-- Channel Connections
CREATE TABLE channel_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- airbnb, booking_com, vrbo, ical
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, error, disconnected
  access_token TEXT, -- Encrypted
  refresh_token TEXT, -- Encrypted
  token_expires_at TEXT,
  credentials TEXT, -- JSON: Additional credentials (encrypted)
  config TEXT, -- JSON: Sync configuration
  last_sync_at TEXT,
  last_sync_status TEXT,
  last_sync_error TEXT,
  next_sync_at TEXT,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX channel_connections_tenant_idx ON channel_connections(tenant_id);
CREATE INDEX channel_connections_channel_idx ON channel_connections(channel);
CREATE INDEX channel_connections_status_idx ON channel_connections(status);
CREATE INDEX channel_connections_next_sync_idx ON channel_connections(next_sync_at);

-- Channel Listings
CREATE TABLE channel_listings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  external_listing_id TEXT NOT NULL,
  external_url TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, unlinked
  sync_enabled INTEGER NOT NULL DEFAULT 1,
  ical_url TEXT,
  ical_export_url TEXT,
  mapping TEXT, -- JSON: Price markup, min/max stay, etc.
  last_import_at TEXT,
  last_export_at TEXT,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX channel_listings_tenant_idx ON channel_listings(tenant_id);
CREATE INDEX channel_listings_connection_idx ON channel_listings(connection_id);
CREATE INDEX channel_listings_unit_idx ON channel_listings(unit_id);
CREATE INDEX channel_listings_external_id_idx ON channel_listings(external_listing_id);
CREATE UNIQUE INDEX channel_listings_unique_idx ON channel_listings(connection_id, external_listing_id);

-- Channel Bookings
CREATE TABLE channel_bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES channel_listings(id) ON DELETE CASCADE,
  booking_id TEXT, -- References bookings.id (local booking if imported)
  external_booking_id TEXT NOT NULL,
  external_reservation_code TEXT,
  external_status TEXT NOT NULL,
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  guest_count INTEGER,
  check_in_date TEXT NOT NULL,
  check_out_date TEXT NOT NULL,
  nights INTEGER NOT NULL,
  total_amount INTEGER,
  host_payout INTEGER,
  channel_fees INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, imported, cancelled, failed
  import_status TEXT,
  import_error TEXT,
  first_seen_at TEXT NOT NULL,
  last_sync_at TEXT NOT NULL,
  imported_at TEXT,
  raw_data TEXT, -- JSON: Full channel response
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX channel_bookings_tenant_idx ON channel_bookings(tenant_id);
CREATE INDEX channel_bookings_connection_idx ON channel_bookings(connection_id);
CREATE INDEX channel_bookings_listing_idx ON channel_bookings(listing_id);
CREATE INDEX channel_bookings_booking_idx ON channel_bookings(booking_id);
CREATE INDEX channel_bookings_status_idx ON channel_bookings(status);
CREATE INDEX channel_bookings_dates_idx ON channel_bookings(check_in_date, check_out_date);
CREATE UNIQUE INDEX channel_bookings_unique_idx ON channel_bookings(connection_id, external_booking_id);

-- Channel Sync Logs
CREATE TABLE channel_sync_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id TEXT NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- import, export, full
  direction TEXT NOT NULL, -- inbound, outbound, bidirectional
  resource TEXT NOT NULL, -- bookings, availability, pricing, listings
  status TEXT NOT NULL, -- success, partial, error
  started_at TEXT NOT NULL,
  completed_at TEXT,
  items_processed INTEGER DEFAULT 0,
  items_success INTEGER DEFAULT 0,
  items_error INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  errors TEXT, -- JSON: Array of errors
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL
);

CREATE INDEX channel_sync_logs_tenant_idx ON channel_sync_logs(tenant_id);
CREATE INDEX channel_sync_logs_connection_idx ON channel_sync_logs(connection_id);
CREATE INDEX channel_sync_logs_status_idx ON channel_sync_logs(status);
CREATE INDEX channel_sync_logs_created_idx ON channel_sync_logs(created_at);

-- iCal Calendars
CREATE TABLE ical_calendars (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  listing_id TEXT REFERENCES channel_listings(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- subscription (import), export
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  export_token TEXT, -- For export URLs
  include_bookings INTEGER DEFAULT 1,
  include_blocks INTEGER DEFAULT 1,
  last_fetched_at TEXT,
  last_fetch_status TEXT,
  last_fetch_error TEXT,
  events_count INTEGER DEFAULT 0,
  sync_enabled INTEGER NOT NULL DEFAULT 1,
  sync_frequency INTEGER DEFAULT 60, -- minutes
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX ical_calendars_tenant_idx ON ical_calendars(tenant_id);
CREATE INDEX ical_calendars_unit_idx ON ical_calendars(unit_id);
CREATE INDEX ical_calendars_type_idx ON ical_calendars(type);
CREATE INDEX ical_calendars_status_idx ON ical_calendars(status);
CREATE UNIQUE INDEX ical_calendars_export_token_idx ON ical_calendars(export_token);
