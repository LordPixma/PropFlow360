-- PropFlow360 Phase 4: Bookings & Leases

-- Guests
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Basic info
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,

  -- Linked user
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,

  -- Notes
  notes TEXT,
  preferences TEXT,

  -- Stats
  total_bookings INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_guests_tenant ON guests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_guests_user ON guests(user_id);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,

  -- Reference
  booking_ref TEXT NOT NULL,

  -- Dates
  check_in_date TEXT NOT NULL,
  check_out_date TEXT NOT NULL,
  check_in_time TEXT,
  check_out_time TEXT,

  -- Guest count
  adults INTEGER NOT NULL DEFAULT 1,
  children INTEGER DEFAULT 0,
  infants INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show')),

  -- Pricing (cents)
  currency TEXT DEFAULT 'GBP',
  nightly_rate INTEGER NOT NULL,
  total_nights INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  cleaning_fee INTEGER DEFAULT 0,
  service_fee INTEGER DEFAULT 0,
  taxes INTEGER DEFAULT 0,
  discount INTEGER DEFAULT 0,
  total_amount INTEGER NOT NULL,

  -- Payment
  amount_paid INTEGER DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded', 'failed')),

  -- Source
  source TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('direct', 'airbnb', 'booking_com', 'vrbo', 'expedia', 'other')),
  external_id TEXT,

  -- Notes
  guest_notes TEXT,
  internal_notes TEXT,
  special_requests TEXT,

  -- Cancellation
  cancelled_at INTEGER,
  cancelled_by TEXT,
  cancellation_reason TEXT,
  refund_amount INTEGER,

  -- Timestamps
  confirmed_at INTEGER,
  checked_in_at INTEGER,
  checked_out_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  CHECK (check_out_date > check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_unit ON bookings(unit_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(unit_id, check_in_date, check_out_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(tenant_id, booking_ref);
CREATE INDEX IF NOT EXISTS idx_bookings_external ON bookings(source, external_id);

-- Leases
CREATE TABLE IF NOT EXISTS leases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,

  -- Reference
  lease_ref TEXT NOT NULL,

  -- Term
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  lease_type TEXT NOT NULL DEFAULT 'fixed' CHECK (lease_type IN ('fixed', 'month_to_month', 'periodic')),

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signature', 'active', 'expired', 'terminated', 'renewed')),

  -- Rent (cents)
  currency TEXT DEFAULT 'GBP',
  monthly_rent INTEGER NOT NULL,
  deposit INTEGER DEFAULT 0,
  deposit_status TEXT DEFAULT 'pending' CHECK (deposit_status IN ('pending', 'held', 'partially_returned', 'returned', 'forfeited')),

  -- Payment schedule
  rent_due_day INTEGER DEFAULT 1,
  payment_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (payment_frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly')),

  -- Occupants
  primary_occupant TEXT NOT NULL,
  additional_occupants TEXT,

  -- Terms
  notice_period_days INTEGER DEFAULT 30,
  break_clause_date TEXT,
  special_terms TEXT,

  -- Documents
  agreement_doc_url TEXT,
  signed_at INTEGER,
  signed_by_tenant TEXT,
  signed_by_landlord TEXT,

  -- Termination
  terminated_at INTEGER,
  termination_reason TEXT,
  terminated_by TEXT,

  -- Notes
  internal_notes TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),

  CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_property ON leases(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit ON leases(unit_id);
CREATE INDEX IF NOT EXISTS idx_leases_guest ON leases(guest_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leases_dates ON leases(unit_id, start_date, end_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leases_ref ON leases(tenant_id, lease_ref);

-- Lease Rent Schedule
CREATE TABLE IF NOT EXISTS lease_rent_schedule (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lease_id TEXT NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Schedule
  due_date TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,

  -- Amount
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'GBP',

  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'paid', 'partial', 'overdue', 'waived')),

  paid_amount INTEGER DEFAULT 0,
  paid_at INTEGER,
  payment_id TEXT,

  -- Reminders
  reminder_sent_at INTEGER,
  overdue_sent_at INTEGER,

  notes TEXT,

  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_lease_rent_schedule_tenant ON lease_rent_schedule(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lease_rent_schedule_lease ON lease_rent_schedule(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_rent_schedule_due ON lease_rent_schedule(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_lease_rent_schedule_status ON lease_rent_schedule(lease_id, status);
