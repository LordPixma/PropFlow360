-- PropFlow360 Phase 2: Properties, Units, Media, Roles

-- Properties
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('residential', 'commercial', 'studio', 'mixed', 'holiday_let')),
  description TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'GB',
  latitude REAL,
  longitude REAL,

  -- Settings
  timezone TEXT DEFAULT 'Europe/London',
  currency TEXT DEFAULT 'GBP',
  check_in_time TEXT DEFAULT '15:00',
  check_out_time TEXT DEFAULT '11:00',

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),

  -- Additional settings as JSON
  settings TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(tenant_id, status);

-- Units
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('room', 'apartment', 'studio', 'office', 'entire_property', 'suite', 'villa')),
  description TEXT,

  -- Capacity
  max_guests INTEGER DEFAULT 2,
  bedrooms INTEGER DEFAULT 1,
  beds INTEGER DEFAULT 1,
  bathrooms REAL DEFAULT 1,

  -- Size
  size_sqm REAL,
  floor INTEGER,

  -- Amenities (JSON array)
  amenities TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'archived')),

  -- ICS calendar token
  ics_token TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_units_tenant ON units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(tenant_id, status);

-- Unit Pricing
CREATE TABLE IF NOT EXISTS unit_pricing (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  price_type TEXT NOT NULL CHECK (price_type IN ('nightly', 'weekly', 'monthly')),
  base_price INTEGER NOT NULL,

  min_stay INTEGER DEFAULT 1,
  max_stay INTEGER,

  date_from TEXT,
  date_to TEXT,
  days_of_week TEXT,

  priority INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,

  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_unit_pricing_unit ON unit_pricing(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_pricing_dates ON unit_pricing(unit_id, date_from, date_to);

-- Property Media
CREATE TABLE IF NOT EXISTS property_media (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  unit_id TEXT REFERENCES units(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('photo', 'floorplan', 'video', 'document', '360_tour')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,

  title TEXT,
  description TEXT,
  alt_text TEXT,

  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  mime_type TEXT,

  sort_order INTEGER DEFAULT 0,
  is_cover INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_property_media_property ON property_media(property_id);
CREATE INDEX IF NOT EXISTS idx_property_media_unit ON property_media(unit_id);
CREATE INDEX IF NOT EXISTS idx_property_media_tenant ON property_media(tenant_id);

-- Custom Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL,
  is_system INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);

-- User Property Roles (property-level assignments)
CREATE TABLE IF NOT EXISTS user_property_roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('property_manager', 'maintenance_coordinator', 'cleaner', 'front_desk', 'vendor')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(tenant_id, user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_user_property_roles_tenant ON user_property_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_property_roles_user ON user_property_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_property_roles_property ON user_property_roles(property_id);
