/**
 * Analytics Schema
 *
 * Stores aggregated metrics for reporting and dashboards
 * Pre-computed statistics to avoid expensive queries on the fly
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { tenants } from './tenants';
import { properties } from './properties';
import { units } from './units';

/**
 * Daily Metrics
 * Aggregated daily statistics per unit/property
 */
export const dailyMetrics = sqliteTable('daily_metrics', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // ISO date (YYYY-MM-DD)

  // Scope
  propertyId: text('property_id').references(() => properties.id, { onDelete: 'cascade' }),
  unitId: text('unit_id').references(() => units.id, { onDelete: 'cascade' }),

  // Occupancy metrics
  totalUnits: integer('total_units').default(0), // For property-level
  occupiedUnits: integer('occupied_units').default(0),
  availableUnits: integer('available_units').default(0),
  blockedUnits: integer('blocked_units').default(0),
  occupancyRate: integer('occupancy_rate').default(0), // Percentage (0-10000 = 0.00%-100.00%)

  // Booking metrics
  checkIns: integer('check_ins').default(0),
  checkOuts: integer('check_outs').default(0),
  activeBookings: integer('active_bookings').default(0),
  newBookings: integer('new_bookings').default(0),
  cancelledBookings: integer('cancelled_bookings').default(0),

  // Revenue metrics (in cents)
  revenue: integer('revenue').default(0), // Total revenue
  revenueBookings: integer('revenue_bookings').default(0), // From bookings
  revenueRent: integer('revenue_rent').default(0), // From leases
  revenueOther: integer('revenue_other').default(0), // Other income

  // Payment metrics (in cents)
  paymentsReceived: integer('payments_received').default(0),
  paymentsCount: integer('payments_count').default(0),
  outstandingAmount: integer('outstanding_amount').default(0),
  overdueAmount: integer('overdue_amount').default(0),

  // Guest metrics
  totalGuests: integer('total_guests').default(0),
  newGuests: integer('new_guests').default(0),
  returningGuests: integer('returning_guests').default(0),

  // Average metrics (in cents)
  avgDailyRate: integer('avg_daily_rate').default(0), // ADR
  avgBookingValue: integer('avg_booking_value').default(0),
  avgStayLength: integer('avg_stay_length').default(0), // In nights * 100

  // Maintenance metrics
  maintenanceTickets: integer('maintenance_tickets').default(0),
  maintenanceResolved: integer('maintenance_resolved').default(0),
  maintenanceCost: integer('maintenance_cost').default(0), // In cents

  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Monthly Summaries
 * Pre-aggregated monthly statistics for faster reporting
 */
export const monthlySummaries = sqliteTable('monthly_summaries', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Period
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1-12

  // Scope
  propertyId: text('property_id').references(() => properties.id, { onDelete: 'cascade' }),
  unitId: text('unit_id').references(() => units.id, { onDelete: 'cascade' }),

  // Occupancy summary
  totalDays: integer('total_days').notNull(),
  occupiedDays: integer('occupied_days').default(0),
  availableDays: integer('available_days').default(0),
  blockedDays: integer('blocked_days').default(0),
  avgOccupancyRate: integer('avg_occupancy_rate').default(0), // Percentage

  // Booking summary
  totalBookings: integer('total_bookings').default(0),
  confirmedBookings: integer('confirmed_bookings').default(0),
  cancelledBookings: integer('cancelled_bookings').default(0),
  totalNights: integer('total_nights').default(0),
  avgStayLength: integer('avg_stay_length').default(0), // In nights * 100

  // Revenue summary (in cents)
  totalRevenue: integer('total_revenue').default(0),
  bookingRevenue: integer('booking_revenue').default(0),
  rentRevenue: integer('rent_revenue').default(0),
  otherRevenue: integer('other_revenue').default(0),

  // Payment summary (in cents)
  totalPayments: integer('total_payments').default(0),
  paymentCount: integer('payment_count').default(0),
  avgPaymentAmount: integer('avg_payment_amount').default(0),

  // Financial summary (in cents)
  totalExpenses: integer('total_expenses').default(0),
  maintenanceExpenses: integer('maintenance_expenses').default(0),
  cleaningExpenses: integer('cleaning_expenses').default(0),
  netIncome: integer('net_income').default(0), // Revenue - Expenses

  // Guest summary
  totalGuests: integer('total_guests').default(0),
  uniqueGuests: integer('unique_guests').default(0),
  returningGuests: integer('returning_guests').default(0),

  // Performance metrics
  avgDailyRate: integer('avg_daily_rate').default(0), // ADR
  revPAR: integer('rev_par').default(0), // Revenue per available room

  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Revenue Breakdown
 * Detailed revenue categorization for reporting
 */
export const revenueBreakdown = sqliteTable('revenue_breakdown', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

  // Period
  date: text('date').notNull(), // ISO date
  periodType: text('period_type').notNull(), // day, week, month, year

  // Scope
  propertyId: text('property_id').references(() => properties.id, { onDelete: 'cascade' }),
  unitId: text('unit_id').references(() => units.id, { onDelete: 'cascade' }),

  // Revenue by source (in cents)
  directBookings: integer('direct_bookings').default(0),
  airbnb: integer('airbnb').default(0),
  bookingCom: integer('booking_com').default(0),
  otherChannels: integer('other_channels').default(0),

  // Revenue by type (in cents)
  accommodation: integer('accommodation').default(0),
  cleaningFees: integer('cleaning_fees').default(0),
  securityDeposits: integer('security_deposits').default(0),
  extraServices: integer('extra_services').default(0),
  lateFees: integer('late_fees').default(0),
  damageFees: integer('damage_fees').default(0),

  // Total
  totalRevenue: integer('total_revenue').default(0),

  createdAt: text('created_at').notNull(),
});

/**
 * Saved Reports
 * User-saved report configurations
 */
export const savedReports = sqliteTable('saved_reports', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id'), // Creator

  name: text('name').notNull(),
  description: text('description'),
  reportType: text('report_type').notNull(), // revenue, occupancy, bookings, maintenance, financial

  // Report configuration
  config: text('config', { mode: 'json' }).$type<{
    dateRange: {
      type: 'custom' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'mtd' | 'ytd';
      startDate?: string;
      endDate?: string;
    };
    filters?: {
      propertyIds?: string[];
      unitIds?: string[];
      channels?: string[];
      status?: string[];
    };
    groupBy?: 'day' | 'week' | 'month' | 'year' | 'property' | 'unit' | 'channel';
    metrics?: string[];
    chartType?: 'line' | 'bar' | 'pie' | 'table';
  }>(),

  // Schedule (optional)
  isScheduled: integer('is_scheduled').default(0),
  schedule: text('schedule', { mode: 'json' }).$type<{
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    time?: string; // HH:mm
    recipients?: string[]; // Email addresses
  }>(),

  lastRunAt: text('last_run_at'),

  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Report Snapshots
 * Historical report data for scheduled reports
 */
export const reportSnapshots = sqliteTable('report_snapshots', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  savedReportId: text('saved_report_id').references(() => savedReports.id, { onDelete: 'cascade' }),

  // Report metadata
  reportType: text('report_type').notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),

  // Report data
  data: text('data', { mode: 'json' }).$type<{
    summary: Record<string, any>;
    chartData?: any[];
    tableData?: any[];
    metadata?: Record<string, any>;
  }>(),

  // Export info
  exportUrl: text('export_url'), // CSV/PDF export URL
  expiresAt: text('expires_at'), // Expiration for export URL

  createdAt: text('created_at').notNull(),
});

export type DailyMetric = typeof dailyMetrics.$inferSelect;
export type NewDailyMetric = typeof dailyMetrics.$inferInsert;

export type MonthlySummary = typeof monthlySummaries.$inferSelect;
export type NewMonthlySummary = typeof monthlySummaries.$inferInsert;

export type RevenueBreakdown = typeof revenueBreakdown.$inferSelect;
export type NewRevenueBreakdown = typeof revenueBreakdown.$inferInsert;

export type SavedReport = typeof savedReports.$inferSelect;
export type NewSavedReport = typeof savedReports.$inferInsert;

export type ReportSnapshot = typeof reportSnapshots.$inferSelect;
export type NewReportSnapshot = typeof reportSnapshots.$inferInsert;
