/**
 * Channel Manager Routes
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import {
  channelListings,
  channelBookings,
  icalCalendars,
} from '@propflow360/db';
import { eq, and, desc } from 'drizzle-orm';
import { generateICalFeed } from '@propflow360/ical';
import type { HonoEnv } from '../../types';
import connections from './connections';

const app = new Hono<HonoEnv>();

// Mount connections routes
app.route('/connections', connections);

// === CHANNEL LISTINGS ===

// List channel listings
app.get('/listings', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const connectionId = c.req.query('connection_id');
  const unitId = c.req.query('unit_id');

  const conditions = [eq(channelListings.tenantId, tenantId)];

  if (connectionId) {
    conditions.push(eq(channelListings.connectionId, connectionId));
  }

  if (unitId) {
    conditions.push(eq(channelListings.unitId, unitId));
  }

  const listings = await db
    .select()
    .from(channelListings)
    .where(and(...conditions))
    .orderBy(desc(channelListings.createdAt));

  return c.json({ listings });
});

// Create channel listing (link unit to external listing)
app.post('/listings', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const body = await c.req.json();
  const {
    connectionId,
    propertyId,
    unitId,
    externalListingId,
    externalUrl,
    icalUrl,
    mapping,
  } = body;

  if (!connectionId || !propertyId || !unitId || !externalListingId) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const listingId = `lst_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  // Generate iCal export URL
  const exportToken = crypto.randomUUID();
  const icalExportUrl = `${c.req.url.split('/api')[0]}/api/channels/ical/${exportToken}.ics`;

  await db.insert(channelListings).values({
    id: listingId,
    tenantId,
    connectionId,
    propertyId,
    unitId,
    externalListingId,
    externalUrl: externalUrl || null,
    status: 'active',
    syncEnabled: 1,
    icalUrl: icalUrl || null,
    icalExportUrl,
    mapping: mapping ? JSON.stringify(mapping) : null,
    createdAt: now,
    updatedAt: now,
  });

  const [listing] = await db
    .select()
    .from(channelListings)
    .where(eq(channelListings.id, listingId))
    .limit(1);

  return c.json({ listing }, 201);
});

// Update channel listing
app.patch('/listings/:id', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [existing] = await db
    .select()
    .from(channelListings)
    .where(
      and(
        eq(channelListings.id, id),
        eq(channelListings.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Listing not found' }, 404);
  }

  const body = await c.req.json();
  const { status, syncEnabled, mapping } = body;

  const now = new Date().toISOString();

  await db
    .update(channelListings)
    .set({
      status: status !== undefined ? status : existing.status,
      syncEnabled: syncEnabled !== undefined ? (syncEnabled ? 1 : 0) : existing.syncEnabled,
      mapping: mapping !== undefined ? JSON.stringify(mapping) : existing.mapping,
      updatedAt: now,
    })
    .where(eq(channelListings.id, id));

  const [listing] = await db
    .select()
    .from(channelListings)
    .where(eq(channelListings.id, id))
    .limit(1);

  return c.json({ listing });
});

// Delete channel listing
app.delete('/listings/:id', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [existing] = await db
    .select()
    .from(channelListings)
    .where(
      and(
        eq(channelListings.id, id),
        eq(channelListings.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Listing not found' }, 404);
  }

  await db.delete(channelListings).where(eq(channelListings.id, id));

  return c.json({ success: true });
});

// === CHANNEL BOOKINGS ===

// List channel bookings
app.get('/bookings', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const connectionId = c.req.query('connection_id');
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '50', 10);

  const conditions = [eq(channelBookings.tenantId, tenantId)];

  if (connectionId) {
    conditions.push(eq(channelBookings.connectionId, connectionId));
  }

  if (status) {
    conditions.push(eq(channelBookings.status, status));
  }

  const bookings = await db
    .select()
    .from(channelBookings)
    .where(and(...conditions))
    .orderBy(desc(channelBookings.createdAt))
    .limit(limit);

  return c.json({ bookings });
});

// Get single channel booking
app.get('/bookings/:id', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [booking] = await db
    .select()
    .from(channelBookings)
    .where(
      and(
        eq(channelBookings.id, id),
        eq(channelBookings.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404);
  }

  return c.json({ booking });
});

// === ICAL CALENDARS ===

// List iCal calendars
app.get('/ical', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const unitId = c.req.query('unit_id');

  const conditions = [eq(icalCalendars.tenantId, tenantId)];

  if (unitId) {
    conditions.push(eq(icalCalendars.unitId, unitId));
  }

  const calendars = await db
    .select()
    .from(icalCalendars)
    .where(and(...conditions))
    .orderBy(desc(icalCalendars.createdAt));

  return c.json({ calendars });
});

// Create iCal calendar
app.post('/ical', async (c) => {
  const { tenantId } = c.get('auth');
  const db = drizzle(c.env.DB_CORE);

  const body = await c.req.json();
  const {
    unitId,
    type,
    name,
    url,
    includeBookings,
    includeBlocks,
    syncFrequency,
  } = body;

  if (!unitId || !type || !name) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (type === 'subscription' && !url) {
    return c.json({ error: 'URL required for subscriptions' }, 400);
  }

  const calendarId = `ical_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  let exportToken: string | null = null;
  let exportUrl: string | null = null;

  if (type === 'export') {
    exportToken = crypto.randomUUID();
    exportUrl = `${c.req.url.split('/api')[0]}/api/channels/ical/${exportToken}.ics`;
  }

  await db.insert(icalCalendars).values({
    id: calendarId,
    tenantId,
    unitId,
    type,
    name,
    url: type === 'export' ? exportUrl! : url,
    exportToken,
    includeBookings: includeBookings !== false ? 1 : 0,
    includeBlocks: includeBlocks !== false ? 1 : 0,
    syncFrequency: syncFrequency || 60,
    syncEnabled: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  const [calendar] = await db
    .select()
    .from(icalCalendars)
    .where(eq(icalCalendars.id, calendarId))
    .limit(1);

  return c.json({ calendar }, 201);
});

// Delete iCal calendar
app.delete('/ical/:id', async (c) => {
  const { tenantId } = c.get('auth');
  const { id } = c.param();
  const db = drizzle(c.env.DB_CORE);

  const [existing] = await db
    .select()
    .from(icalCalendars)
    .where(
      and(
        eq(icalCalendars.id, id),
        eq(icalCalendars.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Calendar not found' }, 404);
  }

  await db.delete(icalCalendars).where(eq(icalCalendars.id, id));

  return c.json({ success: true });
});

// === PUBLIC ICAL EXPORT (no auth) ===

// Export iCal feed
app.get('/ical/:token.ics', async (c) => {
  const { token } = c.param();
  const db = drizzle(c.env.DB_CORE);

  // Find calendar by export token
  const [calendar] = await db
    .select()
    .from(icalCalendars)
    .where(eq(icalCalendars.exportToken, token))
    .limit(1);

  if (!calendar) {
    return c.text('Calendar not found', 404);
  }

  // Fetch bookings and blocks for the unit
  // This is a simplified version - in production, fetch from DB
  const events = [
    {
      uid: 'example@propflow360.com',
      summary: 'Booked',
      startDate: '2024-06-15',
      endDate: '2024-06-20',
      status: 'CONFIRMED' as const,
    },
  ];

  const icalData = generateICalFeed({
    calendarName: calendar.name,
    events,
  });

  return c.text(icalData, 200, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="${calendar.name}.ics"`,
  });
});

export default app;
