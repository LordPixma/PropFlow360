-- Migration: 0009_analytics
-- Description: Add analytics and reporting tables

-- Daily Metrics
CREATE TABLE daily_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date TEXT NOT NULL, -- ISO date
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  unit_id TEXT REFERENCES units(id) ON DELETE CASCADE,

  -- Occupancy metrics
  total_units INTEGER DEFAULT 0,
  occupied_units INTEGER DEFAULT 0,
  available_units INTEGER DEFAULT 0,
  blocked_units INTEGER DEFAULT 0,
  occupancy_rate INTEGER DEFAULT 0, -- Percentage (0-10000)

  -- Booking metrics
  check_ins INTEGER DEFAULT 0,
  check_outs INTEGER DEFAULT 0,
  active_bookings INTEGER DEFAULT 0,
  new_bookings INTEGER DEFAULT 0,
  cancelled_bookings INTEGER DEFAULT 0,

  -- Revenue metrics (cents)
  revenue INTEGER DEFAULT 0,
  revenue_bookings INTEGER DEFAULT 0,
  revenue_rent INTEGER DEFAULT 0,
  revenue_other INTEGER DEFAULT 0,

  -- Payment metrics (cents)
  payments_received INTEGER DEFAULT 0,
  payments_count INTEGER DEFAULT 0,
  outstanding_amount INTEGER DEFAULT 0,
  overdue_amount INTEGER DEFAULT 0,

  -- Guest metrics
  total_guests INTEGER DEFAULT 0,
  new_guests INTEGER DEFAULT 0,
  returning_guests INTEGER DEFAULT 0,

  -- Average metrics (cents)
  avg_daily_rate INTEGER DEFAULT 0,
  avg_booking_value INTEGER DEFAULT 0,
  avg_stay_length INTEGER DEFAULT 0, -- Nights * 100

  -- Maintenance metrics
  maintenance_tickets INTEGER DEFAULT 0,
  maintenance_resolved INTEGER DEFAULT 0,
  maintenance_cost INTEGER DEFAULT 0, -- Cents

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX daily_metrics_tenant_idx ON daily_metrics(tenant_id);
CREATE INDEX daily_metrics_date_idx ON daily_metrics(date);
CREATE INDEX daily_metrics_property_idx ON daily_metrics(property_id);
CREATE INDEX daily_metrics_unit_idx ON daily_metrics(unit_id);
CREATE UNIQUE INDEX daily_metrics_unique_idx ON daily_metrics(tenant_id, date, COALESCE(property_id, ''), COALESCE(unit_id, ''));

-- Monthly Summaries
CREATE TABLE monthly_summaries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 1-12
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  unit_id TEXT REFERENCES units(id) ON DELETE CASCADE,

  -- Occupancy summary
  total_days INTEGER NOT NULL,
  occupied_days INTEGER DEFAULT 0,
  available_days INTEGER DEFAULT 0,
  blocked_days INTEGER DEFAULT 0,
  avg_occupancy_rate INTEGER DEFAULT 0, -- Percentage

  -- Booking summary
  total_bookings INTEGER DEFAULT 0,
  confirmed_bookings INTEGER DEFAULT 0,
  cancelled_bookings INTEGER DEFAULT 0,
  total_nights INTEGER DEFAULT 0,
  avg_stay_length INTEGER DEFAULT 0, -- Nights * 100

  -- Revenue summary (cents)
  total_revenue INTEGER DEFAULT 0,
  booking_revenue INTEGER DEFAULT 0,
  rent_revenue INTEGER DEFAULT 0,
  other_revenue INTEGER DEFAULT 0,

  -- Payment summary (cents)
  total_payments INTEGER DEFAULT 0,
  payment_count INTEGER DEFAULT 0,
  avg_payment_amount INTEGER DEFAULT 0,

  -- Financial summary (cents)
  total_expenses INTEGER DEFAULT 0,
  maintenance_expenses INTEGER DEFAULT 0,
  cleaning_expenses INTEGER DEFAULT 0,
  net_income INTEGER DEFAULT 0,

  -- Guest summary
  total_guests INTEGER DEFAULT 0,
  unique_guests INTEGER DEFAULT 0,
  returning_guests INTEGER DEFAULT 0,

  -- Performance metrics (cents)
  avg_daily_rate INTEGER DEFAULT 0,
  rev_par INTEGER DEFAULT 0, -- Revenue per available room

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX monthly_summaries_tenant_idx ON monthly_summaries(tenant_id);
CREATE INDEX monthly_summaries_period_idx ON monthly_summaries(year, month);
CREATE INDEX monthly_summaries_property_idx ON monthly_summaries(property_id);
CREATE INDEX monthly_summaries_unit_idx ON monthly_summaries(unit_id);
CREATE UNIQUE INDEX monthly_summaries_unique_idx ON monthly_summaries(tenant_id, year, month, COALESCE(property_id, ''), COALESCE(unit_id, ''));

-- Revenue Breakdown
CREATE TABLE revenue_breakdown (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  period_type TEXT NOT NULL, -- day, week, month, year
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  unit_id TEXT REFERENCES units(id) ON DELETE CASCADE,

  -- Revenue by source (cents)
  direct_bookings INTEGER DEFAULT 0,
  airbnb INTEGER DEFAULT 0,
  booking_com INTEGER DEFAULT 0,
  other_channels INTEGER DEFAULT 0,

  -- Revenue by type (cents)
  accommodation INTEGER DEFAULT 0,
  cleaning_fees INTEGER DEFAULT 0,
  security_deposits INTEGER DEFAULT 0,
  extra_services INTEGER DEFAULT 0,
  late_fees INTEGER DEFAULT 0,
  damage_fees INTEGER DEFAULT 0,

  total_revenue INTEGER DEFAULT 0,

  created_at TEXT NOT NULL
);

CREATE INDEX revenue_breakdown_tenant_idx ON revenue_breakdown(tenant_id);
CREATE INDEX revenue_breakdown_date_idx ON revenue_breakdown(date);
CREATE INDEX revenue_breakdown_period_idx ON revenue_breakdown(period_type);
CREATE INDEX revenue_breakdown_property_idx ON revenue_breakdown(property_id);

-- Saved Reports
CREATE TABLE saved_reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- revenue, occupancy, bookings, maintenance, financial
  config TEXT, -- JSON configuration
  is_scheduled INTEGER DEFAULT 0,
  schedule TEXT, -- JSON schedule config
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX saved_reports_tenant_idx ON saved_reports(tenant_id);
CREATE INDEX saved_reports_type_idx ON saved_reports(report_type);
CREATE INDEX saved_reports_user_idx ON saved_reports(user_id);

-- Report Snapshots
CREATE TABLE report_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  saved_report_id TEXT REFERENCES saved_reports(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  data TEXT, -- JSON report data
  export_url TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX report_snapshots_tenant_idx ON report_snapshots(tenant_id);
CREATE INDEX report_snapshots_report_idx ON report_snapshots(saved_report_id);
CREATE INDEX report_snapshots_created_idx ON report_snapshots(created_at);
