-- PropFlow360 Phase 3: Calendar & Availability

-- Availability Blocks (bookings, holds, manual blocks)
CREATE TABLE IF NOT EXISTS availability_blocks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  -- Block type: booking, hold, blocked, maintenance, owner_use
  block_type TEXT NOT NULL CHECK (block_type IN ('booking', 'hold', 'blocked', 'maintenance', 'owner_use')),

  -- Date range (YYYY-MM-DD format)
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,

  -- Reference to booking if type is 'booking'
  booking_id TEXT,

  -- Hold-specific fields
  hold_token TEXT,
  hold_expires_at INTEGER,

  -- Notes and source
  notes TEXT,
  source TEXT DEFAULT 'manual',
  external_id TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  -- Ensure end_date > start_date
  CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_availability_blocks_tenant ON availability_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_availability_blocks_unit ON availability_blocks(unit_id);
CREATE INDEX IF NOT EXISTS idx_availability_blocks_unit_dates ON availability_blocks(unit_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_availability_blocks_hold_expires ON availability_blocks(block_type, hold_expires_at);
CREATE INDEX IF NOT EXISTS idx_availability_blocks_booking ON availability_blocks(booking_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_availability_blocks_hold_token ON availability_blocks(hold_token);

-- Calendar Syncs (iCal imports/exports)
CREATE TABLE IF NOT EXISTS calendar_syncs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  -- Calendar source
  name TEXT NOT NULL,
  ics_url TEXT NOT NULL,

  -- Sync settings
  sync_direction TEXT NOT NULL DEFAULT 'import' CHECK (sync_direction IN ('import', 'export', 'both')),
  sync_interval_minutes INTEGER DEFAULT 60,
  is_active INTEGER DEFAULT 1,

  -- Last sync status
  last_sync_at INTEGER,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'error', 'pending')),
  last_sync_error TEXT,
  last_sync_events_count INTEGER,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_calendar_syncs_tenant ON calendar_syncs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendar_syncs_unit ON calendar_syncs(unit_id);
CREATE INDEX IF NOT EXISTS idx_calendar_syncs_active ON calendar_syncs(is_active, last_sync_at);
