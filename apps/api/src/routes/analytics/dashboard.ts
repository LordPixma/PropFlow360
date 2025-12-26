/**
 * Dashboard Analytics Routes
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { dailyMetrics, monthlySummaries } from '@propflow360/db';
import { eq, and, gte, lte, desc, isNull } from 'drizzle-orm';
import type { HonoEnv } from '../../types';

const app = new Hono<HonoEnv>();

// Get dashboard overview
app.get('/overview', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const period = c.req.query('period') || 'last_30_days';
  const { startDate, endDate } = getPeriodDates(period);

  // Get aggregated metrics for period
  const metrics = await db
    .select()
    .from(dailyMetrics)
    .where(
      and(
        eq(dailyMetrics.tenantId, tenantId),
        isNull(dailyMetrics.propertyId),
        isNull(dailyMetrics.unitId),
        gte(dailyMetrics.date, startDate),
        lte(dailyMetrics.date, endDate)
      )
    )
    .orderBy(desc(dailyMetrics.date));

  // Calculate summary stats
  const totalRevenue = metrics.reduce((sum, m) => sum + (m.revenue || 0), 0);
  const totalBookings = metrics.reduce((sum, m) => sum + (m.newBookings || 0), 0);
  const totalGuests = metrics.reduce((sum, m) => sum + (m.totalGuests || 0), 0);
  const avgOccupancyRate = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + (m.occupancyRate || 0), 0) / metrics.length
    : 0;

  // Get today's stats
  const today = new Date().toISOString().split('T')[0];
  const todayMetrics = metrics.find(m => m.date === today);

  return c.json({
    summary: {
      totalRevenue: totalRevenue / 100, // Convert to dollars
      totalBookings,
      totalGuests,
      avgOccupancyRate: (avgOccupancyRate / 100).toFixed(2), // Percentage
      activeBookings: todayMetrics?.activeBookings || 0,
      checkInsToday: todayMetrics?.checkIns || 0,
      checkOutsToday: todayMetrics?.checkOuts || 0,
    },
    chartData: metrics.map(m => ({
      date: m.date,
      revenue: m.revenue / 100,
      bookings: m.newBookings,
      occupancyRate: (m.occupancyRate / 100).toFixed(2),
    })),
  });
});

// Get revenue analytics
app.get('/revenue', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const period = c.req.query('period') || 'last_30_days';
  const _groupBy = c.req.query('group_by') || 'day';
  const { startDate, endDate } = getPeriodDates(period);

  const metrics = await db
    .select()
    .from(dailyMetrics)
    .where(
      and(
        eq(dailyMetrics.tenantId, tenantId),
        isNull(dailyMetrics.propertyId),
        isNull(dailyMetrics.unitId),
        gte(dailyMetrics.date, startDate),
        lte(dailyMetrics.date, endDate)
      )
    )
    .orderBy(dailyMetrics.date);

  return c.json({
    total: metrics.reduce((sum, m) => sum + (m.revenue || 0), 0) / 100,
    breakdown: {
      bookings: metrics.reduce((sum, m) => sum + (m.revenueBookings || 0), 0) / 100,
      rent: metrics.reduce((sum, m) => sum + (m.revenueRent || 0), 0) / 100,
      other: metrics.reduce((sum, m) => sum + (m.revenueOther || 0), 0) / 100,
    },
    chartData: metrics.map(m => ({
      date: m.date,
      revenue: m.revenue / 100,
      bookings: m.revenueBookings / 100,
      rent: m.revenueRent / 100,
    })),
  });
});

// Get occupancy analytics
app.get('/occupancy', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const period = c.req.query('period') || 'last_30_days';
  const propertyId = c.req.query('property_id');
  const { startDate, endDate } = getPeriodDates(period);

  const conditions = [
    eq(dailyMetrics.tenantId, tenantId),
    gte(dailyMetrics.date, startDate),
    lte(dailyMetrics.date, endDate),
  ];

  if (propertyId) {
    conditions.push(eq(dailyMetrics.propertyId, propertyId));
  } else {
    conditions.push(isNull(dailyMetrics.propertyId));
    conditions.push(isNull(dailyMetrics.unitId));
  }

  const metrics = await db
    .select()
    .from(dailyMetrics)
    .where(and(...conditions))
    .orderBy(dailyMetrics.date);

  const avgOccupancy = metrics.length > 0
    ? metrics.reduce((sum, m) => sum + (m.occupancyRate || 0), 0) / metrics.length
    : 0;

  return c.json({
    avgOccupancyRate: (avgOccupancy / 100).toFixed(2),
    chartData: metrics.map(m => ({
      date: m.date,
      occupancyRate: (m.occupancyRate / 100).toFixed(2),
      occupiedUnits: m.occupiedUnits,
      totalUnits: m.totalUnits,
    })),
  });
});

// Get booking analytics
app.get('/bookings', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const period = c.req.query('period') || 'last_30_days';
  const { startDate, endDate } = getPeriodDates(period);

  const metrics = await db
    .select()
    .from(dailyMetrics)
    .where(
      and(
        eq(dailyMetrics.tenantId, tenantId),
        isNull(dailyMetrics.propertyId),
        isNull(dailyMetrics.unitId),
        gte(dailyMetrics.date, startDate),
        lte(dailyMetrics.date, endDate)
      )
    )
    .orderBy(dailyMetrics.date);

  const totalBookings = metrics.reduce((sum, m) => sum + (m.newBookings || 0), 0);
  const totalCancelled = metrics.reduce((sum, m) => sum + (m.cancelledBookings || 0), 0);
  const cancellationRate = totalBookings > 0
    ? ((totalCancelled / totalBookings) * 100).toFixed(2)
    : '0';

  return c.json({
    totalBookings,
    totalCancelled,
    cancellationRate,
    chartData: metrics.map(m => ({
      date: m.date,
      newBookings: m.newBookings,
      cancelledBookings: m.cancelledBookings,
      activeBookings: m.activeBookings,
    })),
  });
});

// Get monthly comparison
app.get('/monthly-comparison', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const months = parseInt(c.req.query('months') || '12', 10);

  const summaries = await db
    .select()
    .from(monthlySummaries)
    .where(
      and(
        eq(monthlySummaries.tenantId, tenantId),
        isNull(monthlySummaries.propertyId),
        isNull(monthlySummaries.unitId)
      )
    )
    .orderBy(desc(monthlySummaries.year), desc(monthlySummaries.month))
    .limit(months);

  return c.json({
    summaries: summaries.map(s => ({
      period: `${s.year}-${String(s.month).padStart(2, '0')}`,
      revenue: (s.totalRevenue || 0) / 100,
      bookings: s.totalBookings,
      occupancyRate: ((s.avgOccupancyRate || 0) / 100).toFixed(2),
      avgDailyRate: (s.avgDailyRate || 0) / 100,
      revPAR: (s.revPAR || 0) / 100,
    })),
  });
});

function getPeriodDates(period: string): { startDate: string; endDate: string } {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const endDate = today.toISOString().split('T')[0];

  let startDate: string;

  switch (period) {
    case 'today':
      startDate = endDate;
      break;
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      startDate = yesterday.toISOString().split('T')[0];
      break;
    }
    case 'last_7_days': {
      const last7 = new Date(today);
      last7.setUTCDate(last7.getUTCDate() - 7);
      startDate = last7.toISOString().split('T')[0];
      break;
    }
    case 'last_30_days': {
      const last30 = new Date(today);
      last30.setUTCDate(last30.getUTCDate() - 30);
      startDate = last30.toISOString().split('T')[0];
      break;
    }
    case 'last_90_days': {
      const last90 = new Date(today);
      last90.setUTCDate(last90.getUTCDate() - 90);
      startDate = last90.toISOString().split('T')[0];
      break;
    }
    case 'mtd': // Month to date
      startDate = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-01`;
      break;
    case 'ytd': // Year to date
      startDate = `${today.getUTCFullYear()}-01-01`;
      break;
    default: {
      const last30default = new Date(today);
      last30default.setUTCDate(last30default.getUTCDate() - 30);
      startDate = last30default.toISOString().split('T')[0];
    }
  }

  return { startDate, endDate };
}

export default app;
