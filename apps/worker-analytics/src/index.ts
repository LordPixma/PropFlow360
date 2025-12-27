/**
 * Analytics Aggregation Worker
 *
 * Runs daily at 1 AM UTC to compute and store analytics metrics
 * Aggregates daily metrics and monthly summaries for fast reporting
 */

import { drizzle } from 'drizzle-orm/d1';
import {
  dailyMetrics,
  monthlySummaries,
  bookings,
  payments,
  invoices,
  units,
  properties,
  guests,
  maintenanceTickets,
} from '@propflow360/db';
import { eq, and, gte, lte, count, sum, sql } from 'drizzle-orm';

interface Env {
  DB_CORE: D1Database;
}

export default {
  // Cron trigger - runs daily at 1 AM UTC
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Analytics aggregation worker triggered:', new Date().toISOString());

    const db = drizzle(env.DB_CORE);

    // Aggregate yesterday's data
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    const dateStr = yesterday.toISOString().substring(0, 10);

    try {
      // Get all tenants
      const tenantsResult = await env.DB_CORE.prepare(
        'SELECT DISTINCT tenant_id FROM properties'
      ).all();

      const tenantIds = tenantsResult.results.map((r: any) => r.tenant_id as string);

      console.log(`Processing analytics for ${tenantIds.length} tenants`);

      for (const tenantId of tenantIds) {
        ctx.waitUntil(aggregateDailyMetrics(db, env.DB_CORE, tenantId, dateStr));
      }

      // Aggregate monthly summaries for last month if it's the 1st day of month
      const today = new Date();
      if (today.getUTCDate() === 1) {
        const lastMonth = new Date(today);
        lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
        const year = lastMonth.getUTCFullYear();
        const month = lastMonth.getUTCMonth() + 1;

        console.log(`Aggregating monthly summaries for ${year}-${month}`);

        for (const tenantId of tenantIds) {
          ctx.waitUntil(aggregateMonthlySummary(db, env.DB_CORE, tenantId, year, month));
        }
      }
    } catch (error) {
      console.error('Error in analytics aggregation:', error);
    }
  },

  // HTTP endpoint for manual triggering
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    if (url.pathname === '/aggregate' && request.method === 'POST') {
      const db = drizzle(env.DB_CORE);
      const body = await request.json() as { tenantId?: string; date?: string };

      const dateStr = body.date || new Date().toISOString().substring(0, 10);
      const tenantId = body.tenantId;

      if (!tenantId) {
        return Response.json({ error: 'tenantId required' }, { status: 400 });
      }

      await aggregateDailyMetrics(db, env.DB_CORE, tenantId, dateStr);

      return Response.json({ success: true, date: dateStr });
    }

    return new Response('Not Found', { status: 404 });
  },
};

/**
 * Aggregate daily metrics for a tenant
 */
async function aggregateDailyMetrics(
  db: any,
  rawDb: D1Database,
  tenantId: string,
  date: string
): Promise<void> {
  const now = new Date().toISOString();

  console.log(`Aggregating daily metrics for tenant ${tenantId} on ${date}`);

  // Get all properties for tenant
  const propertiesResult = await rawDb.prepare(
    'SELECT id FROM properties WHERE tenant_id = ?'
  ).bind(tenantId).all();

  const propertyIds = propertiesResult.results.map((r: any) => r.id);

  // Aggregate tenant-level metrics
  await aggregateTenantMetrics(db, rawDb, tenantId, date, now);

  // Aggregate property-level metrics
  for (const propertyId of propertyIds) {
    await aggregatePropertyMetrics(db, rawDb, tenantId, propertyId as string, date, now);
  }

  console.log(`✓ Completed daily metrics for tenant ${tenantId}`);
}

/**
 * Aggregate tenant-level daily metrics
 */
async function aggregateTenantMetrics(
  db: any,
  rawDb: D1Database,
  tenantId: string,
  date: string,
  now: string
): Promise<void> {
  const metricId = `dm_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;

  // Get total units
  const totalUnitsResult = await rawDb.prepare(
    'SELECT COUNT(*) as count FROM units WHERE tenant_id = ?'
  ).bind(tenantId).first<{ count: number }>();

  const totalUnits = totalUnitsResult?.count || 0;

  // Get bookings for the date
  const bookingsResult = await rawDb.prepare(`
    SELECT
      COUNT(*) as total_bookings,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN check_in_date = ? THEN 1 ELSE 0 END) as check_ins,
      SUM(CASE WHEN check_out_date = ? THEN 1 ELSE 0 END) as check_outs,
      SUM(CASE WHEN ? >= check_in_date AND ? < check_out_date THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN DATE(created_at) = ? THEN 1 ELSE 0 END) as new_bookings,
      SUM(CASE WHEN status = 'cancelled' AND DATE(updated_at) = ? THEN 1 ELSE 0 END) as cancelled
    FROM bookings
    WHERE tenant_id = ?
  `).bind(date, date, date, date, date, date, tenantId).first<any>();

  const activeBookings = bookingsResult?.active || 0;
  const occupancyRate = totalUnits > 0 ? Math.floor((activeBookings / totalUnits) * 10000) : 0;

  // Get revenue for the date
  const revenueResult = await rawDb.prepare(`
    SELECT
      SUM(CASE WHEN b.source = 'direct' THEN b.total_amount ELSE 0 END) as direct_revenue,
      SUM(b.total_amount) as total_revenue
    FROM bookings b
    WHERE b.tenant_id = ?
      AND ? >= b.check_in_date
      AND ? < b.check_out_date
  `).bind(tenantId, date, date).first<any>();

  const revenue = revenueResult?.total_revenue || 0;

  // Get payment metrics
  const paymentResult = await rawDb.prepare(`
    SELECT
      SUM(p.amount) as total_payments,
      COUNT(*) as payment_count
    FROM payments p
    WHERE p.tenant_id = ?
      AND DATE(p.paid_at) = ?
      AND p.status = 'succeeded'
  `).bind(tenantId, date).first<any>();

  const paymentsReceived = paymentResult?.total_payments || 0;
  const paymentsCount = paymentResult?.payment_count || 0;

  // Get outstanding amounts
  const outstandingResult = await rawDb.prepare(`
    SELECT
      SUM(i.total_amount - i.paid_amount) as outstanding,
      SUM(CASE WHEN i.due_date < ? AND i.status != 'paid' THEN i.total_amount - i.paid_amount ELSE 0 END) as overdue
    FROM invoices i
    WHERE i.tenant_id = ?
      AND i.status != 'cancelled'
  `).bind(date, tenantId).first<any>();

  const outstandingAmount = outstandingResult?.outstanding || 0;
  const overdueAmount = outstandingResult?.overdue || 0;

  // Get guest metrics
  const guestResult = await rawDb.prepare(`
    SELECT
      COUNT(DISTINCT b.guest_id) as total_guests,
      SUM(CASE WHEN g.total_bookings = 1 THEN 1 ELSE 0 END) as new_guests,
      SUM(CASE WHEN g.total_bookings > 1 THEN 1 ELSE 0 END) as returning_guests
    FROM bookings b
    JOIN guests g ON g.id = b.guest_id
    WHERE b.tenant_id = ?
      AND ? >= b.check_in_date
      AND ? < b.check_out_date
  `).bind(tenantId, date, date).first<any>();

  const totalGuests = guestResult?.total_guests || 0;
  const newGuests = guestResult?.new_guests || 0;
  const returningGuests = guestResult?.returning_guests || 0;

  // Get maintenance metrics
  const maintenanceResult = await rawDb.prepare(`
    SELECT
      SUM(CASE WHEN DATE(created_at) = ? THEN 1 ELSE 0 END) as new_tickets,
      SUM(CASE WHEN status = 'closed' AND DATE(updated_at) = ? THEN 1 ELSE 0 END) as resolved
    FROM maintenance_tickets
    WHERE tenant_id = ?
  `).bind(date, date, tenantId).first<any>();

  const maintenanceTicketsCount = maintenanceResult?.new_tickets || 0;
  const maintenanceResolved = maintenanceResult?.resolved || 0;

  // Calculate ADR
  const avgDailyRate = activeBookings > 0 ? Math.floor(revenue / activeBookings) : 0;

  // Insert or update daily metric
  await rawDb.prepare(`
    INSERT INTO daily_metrics (
      id, tenant_id, date, property_id, unit_id,
      total_units, occupied_units, available_units, blocked_units, occupancy_rate,
      check_ins, check_outs, active_bookings, new_bookings, cancelled_bookings,
      revenue, revenue_bookings, revenue_rent, revenue_other,
      payments_received, payments_count, outstanding_amount, overdue_amount,
      total_guests, new_guests, returning_guests,
      avg_daily_rate, avg_booking_value, avg_stay_length,
      maintenance_tickets, maintenance_resolved, maintenance_cost,
      created_at, updated_at
    ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, date, COALESCE(property_id, ''), COALESCE(unit_id, ''))
    DO UPDATE SET
      total_units = ?, occupied_units = ?, occupancy_rate = ?,
      check_ins = ?, check_outs = ?, active_bookings = ?, new_bookings = ?, cancelled_bookings = ?,
      revenue = ?, payments_received = ?, payments_count = ?, outstanding_amount = ?, overdue_amount = ?,
      total_guests = ?, new_guests = ?, returning_guests = ?,
      avg_daily_rate = ?, maintenance_tickets = ?, maintenance_resolved = ?,
      updated_at = ?
  `).bind(
    metricId, tenantId, date,
    totalUnits, activeBookings, totalUnits - activeBookings, 0, occupancyRate,
    bookingsResult?.check_ins || 0, bookingsResult?.check_outs || 0,
    activeBookings, bookingsResult?.new_bookings || 0, bookingsResult?.cancelled || 0,
    revenue, revenue, 0, 0,
    paymentsReceived, paymentsCount, outstandingAmount, overdueAmount,
    totalGuests, newGuests, returningGuests,
    avgDailyRate, 0, 0,
    maintenanceTicketsCount, maintenanceResolved, 0,
    now, now,
    // Update values
    totalUnits, activeBookings, occupancyRate,
    bookingsResult?.check_ins || 0, bookingsResult?.check_outs || 0,
    activeBookings, bookingsResult?.new_bookings || 0, bookingsResult?.cancelled || 0,
    revenue, paymentsReceived, paymentsCount, outstandingAmount, overdueAmount,
    totalGuests, newGuests, returningGuests,
    avgDailyRate, maintenanceTicketsCount, maintenanceResolved,
    now
  ).run();
}

/**
 * Aggregate property-level daily metrics
 */
async function aggregatePropertyMetrics(
  db: any,
  rawDb: D1Database,
  tenantId: string,
  propertyId: string,
  date: string,
  now: string
): Promise<void> {
  const metricId = `dm_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;

  // Get total units for property
  const totalUnitsResult = await rawDb.prepare(
    'SELECT COUNT(*) as count FROM units WHERE property_id = ?'
  ).bind(propertyId).first<{ count: number }>();

  const totalUnits = totalUnitsResult?.count || 0;

  // Get active bookings for property
  const activeBookingsResult = await rawDb.prepare(`
    SELECT COUNT(*) as count
    FROM bookings
    WHERE property_id = ?
      AND ? >= check_in_date
      AND ? < check_out_date
      AND status = 'confirmed'
  `).bind(propertyId, date, date).first<{ count: number }>();

  const activeBookings = activeBookingsResult?.count || 0;
  const occupancyRate = totalUnits > 0 ? Math.floor((activeBookings / totalUnits) * 10000) : 0;

  // Get revenue for property
  const revenueResult = await rawDb.prepare(`
    SELECT SUM(total_amount) as revenue
    FROM bookings
    WHERE property_id = ?
      AND ? >= check_in_date
      AND ? < check_out_date
  `).bind(propertyId, date, date).first<{ revenue: number }>();

  const revenue = revenueResult?.revenue || 0;

  // Insert property-level metric
  await rawDb.prepare(`
    INSERT INTO daily_metrics (
      id, tenant_id, date, property_id, unit_id,
      total_units, occupied_units, available_units, blocked_units, occupancy_rate,
      revenue,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, date, COALESCE(property_id, ''), COALESCE(unit_id, ''))
    DO UPDATE SET
      total_units = ?, occupied_units = ?, occupancy_rate = ?, revenue = ?, updated_at = ?
  `).bind(
    metricId, tenantId, date, propertyId,
    totalUnits, activeBookings, totalUnits - activeBookings, 0, occupancyRate,
    revenue,
    now, now,
    totalUnits, activeBookings, occupancyRate, revenue, now
  ).run();
}

/**
 * Aggregate monthly summary
 */
async function aggregateMonthlySummary(
  db: any,
  rawDb: D1Database,
  tenantId: string,
  year: number,
  month: number
): Promise<void> {
  const summaryId = `ms_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  // Calculate date range
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
  const totalDays = new Date(year, month, 0).getDate();

  // Aggregate from daily metrics
  const dailyResult = await rawDb.prepare(`
    SELECT
      SUM(occupied_units) as total_occupied,
      SUM(available_units) as total_available,
      SUM(revenue) as total_revenue,
      SUM(payments_received) as total_payments,
      SUM(new_bookings) as total_bookings,
      SUM(cancelled_bookings) as cancelled_bookings,
      AVG(avg_daily_rate) as avg_daily_rate,
      SUM(total_guests) as total_guests
    FROM daily_metrics
    WHERE tenant_id = ?
      AND property_id IS NULL
      AND unit_id IS NULL
      AND date >= ?
      AND date <= ?
  `).bind(tenantId, startDate, endDate).first<any>();

  const occupiedDays = dailyResult?.total_occupied || 0;
  const availableDays = dailyResult?.total_available || 0;
  const totalRevenue = dailyResult?.total_revenue || 0;
  const totalPayments = dailyResult?.total_payments || 0;
  const totalBookings = dailyResult?.total_bookings || 0;
  const cancelledBookings = dailyResult?.cancelled_bookings || 0;
  const avgDailyRate = dailyResult?.avg_daily_rate || 0;
  const totalGuests = dailyResult?.total_guests || 0;

  const avgOccupancyRate = (occupiedDays + availableDays) > 0
    ? Math.floor((occupiedDays / (occupiedDays + availableDays)) * 10000)
    : 0;

  // Insert monthly summary
  await rawDb.prepare(`
    INSERT INTO monthly_summaries (
      id, tenant_id, year, month, property_id, unit_id,
      total_days, occupied_days, available_days, blocked_days, avg_occupancy_rate,
      total_bookings, confirmed_bookings, cancelled_bookings,
      total_revenue, booking_revenue, total_payments,
      total_guests, avg_daily_rate,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, year, month, COALESCE(property_id, ''), COALESCE(unit_id, ''))
    DO UPDATE SET
      occupied_days = ?, avg_occupancy_rate = ?, total_bookings = ?, total_revenue = ?, total_payments = ?, updated_at = ?
  `).bind(
    summaryId, tenantId, year, month,
    totalDays, occupiedDays, availableDays, 0, avgOccupancyRate,
    totalBookings, totalBookings - cancelledBookings, cancelledBookings,
    totalRevenue, totalRevenue, totalPayments,
    totalGuests, avgDailyRate,
    now, now,
    occupiedDays, avgOccupancyRate, totalBookings, totalRevenue, totalPayments, now
  ).run();

  console.log(`✓ Aggregated monthly summary for ${tenantId} ${year}-${month}`);
}
