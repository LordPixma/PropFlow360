/**
 * Channel Sync Worker
 *
 * Syncs bookings, availability, and pricing with external channel platforms
 * Runs on a cron schedule (every 15 minutes)
 */

import { drizzle } from 'drizzle-orm/d1';
import {
  channelConnections,
  channelListings,
  channelBookings,
  channelSyncLogs,
  availabilityBlocks,
  bookings,
  guests,
} from '@propflow360/db';
import { eq, and, lte, or, isNull } from 'drizzle-orm';
import { createChannelProvider } from '@propflow360/channels';
import type { ChannelProvider } from '@propflow360/channels';

interface Env {
  DB_CORE: D1Database;
}

export default {
  // Cron trigger
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Channel sync worker triggered:', new Date().toISOString());

    const db = drizzle(env.DB_CORE);
    const now = new Date().toISOString();

    try {
      // Find connections that need syncing
      const activeConnections = await db
        .select()
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.status, 'active'),
            or(
              isNull(channelConnections.nextSyncAt),
              lte(channelConnections.nextSyncAt, now)
            )
          )
        )
        .limit(20); // Process 20 connections at a time

      console.log(`Found ${activeConnections.length} connections to sync`);

      for (const connection of activeConnections) {
        ctx.waitUntil(syncConnection(db, connection));
      }
    } catch (error) {
      console.error('Error in channel sync worker:', error);
    }
  },

  // HTTP endpoint for manual triggering
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    if (url.pathname === '/sync' && request.method === 'POST') {
      const db = drizzle(env.DB_CORE);
      const body = await request.json() as { connectionId?: string };

      if (body.connectionId) {
        // Sync specific connection
        const [connection] = await db
          .select()
          .from(channelConnections)
          .where(eq(channelConnections.id, body.connectionId))
          .limit(1);

        if (!connection) {
          return Response.json({ error: 'Connection not found' }, { status: 404 });
        }

        const result = await syncConnection(db, connection);
        return Response.json(result);
      } else {
        return Response.json({ error: 'connectionId required' }, { status: 400 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};

/**
 * Sync a single connection
 */
async function syncConnection(db: any, connection: any): Promise<any> {
  const now = new Date().toISOString();
  const logId = `log_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;

  // Create sync log
  await db.insert(channelSyncLogs).values({
    id: logId,
    tenantId: connection.tenantId,
    connectionId: connection.id,
    syncType: 'import',
    direction: 'inbound',
    resource: 'bookings',
    status: 'success',
    startedAt: now,
    itemsProcessed: 0,
    itemsSuccess: 0,
    itemsError: 0,
    itemsSkipped: 0,
    createdAt: now,
  });

  try {
    // Create provider instance
    const config = {
      credentials: connection.credentials || {
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        expiresAt: connection.tokenExpiresAt,
      },
    };

    const provider = createChannelProvider(connection.channel, config);

    // Test connection
    const isConnected = await provider.testConnection();
    if (!isConnected) {
      throw new Error('Connection test failed');
    }

    // Get all listings for this connection
    const listings = await db
      .select()
      .from(channelListings)
      .where(
        and(
          eq(channelListings.connectionId, connection.id),
          eq(channelListings.syncEnabled, 1)
        )
      );

    console.log(`Syncing ${listings.length} listings for connection ${connection.id}`);

    let stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };

    const errors: Array<{ item?: string; error: string }> = [];

    // Sync bookings for each listing
    for (const listing of listings) {
      try {
        const result = await syncListingBookings(db, provider, connection, listing);
        stats.processed += result.processed;
        stats.succeeded += result.succeeded;
        stats.failed += result.failed;
        stats.skipped += result.skipped;
        if (result.errors) {
          errors.push(...result.errors);
        }
      } catch (err) {
        stats.failed++;
        errors.push({
          item: listing.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const completedAt = new Date().toISOString();

    // Update sync log
    await db
      .update(channelSyncLogs)
      .set({
        status: stats.failed > 0 ? 'partial' : 'success',
        completedAt,
        itemsProcessed: stats.processed,
        itemsSuccess: stats.succeeded,
        itemsError: stats.failed,
        itemsSkipped: stats.skipped,
        errors: errors.length > 0 ? JSON.stringify(errors) : null,
      })
      .where(eq(channelSyncLogs.id, logId));

    // Update connection
    const syncFrequency = connection.config?.syncFrequency || 15; // minutes
    const nextSyncAt = new Date(Date.now() + syncFrequency * 60 * 1000).toISOString();

    await db
      .update(channelConnections)
      .set({
        lastSyncAt: now,
        lastSyncStatus: stats.failed > 0 ? 'partial' : 'success',
        lastSyncError: errors.length > 0 ? errors[0]?.error ?? null : null,
        nextSyncAt,
        updatedAt: completedAt,
      })
      .where(eq(channelConnections.id, connection.id));

    console.log(`✓ Synced connection ${connection.id}: ${stats.succeeded}/${stats.processed} succeeded`);

    return {
      success: true,
      stats,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`✗ Failed to sync connection ${connection.id}:`, errorMessage);

    // Update sync log
    await db
      .update(channelSyncLogs)
      .set({
        status: 'error',
        completedAt: new Date().toISOString(),
        errors: JSON.stringify([{ error: errorMessage }]),
      })
      .where(eq(channelSyncLogs.id, logId));

    // Update connection
    await db
      .update(channelConnections)
      .set({
        lastSyncAt: now,
        lastSyncStatus: 'error',
        lastSyncError: errorMessage,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(channelConnections.id, connection.id));

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sync bookings for a single listing
 */
async function syncListingBookings(
  db: any,
  provider: ChannelProvider,
  connection: any,
  listing: any
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors?: Array<{ item?: string; error: string }>;
}> {
  const stats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };
  const errors: Array<{ item?: string; error: string }> = [];

  // Fetch bookings from the last 30 days and next 365 days
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const externalBookings = await provider.fetchBookings({
    listingIds: [listing.externalListingId],
    startDate,
    endDate,
  });

  stats.processed = externalBookings.length;

  for (const externalBooking of externalBookings) {
    try {
      // Check if booking already exists
      const [existing] = await db
        .select()
        .from(channelBookings)
        .where(
          and(
            eq(channelBookings.connectionId, connection.id),
            eq(channelBookings.externalBookingId, externalBooking.id)
          )
        )
        .limit(1);

      const now = new Date().toISOString();

      if (existing) {
        // Update existing booking
        await db
          .update(channelBookings)
          .set({
            externalStatus: externalBooking.status,
            guestName: externalBooking.guest.name,
            guestEmail: externalBooking.guest.email || null,
            guestPhone: externalBooking.guest.phone || null,
            guestCount: externalBooking.guest.guestCount,
            totalAmount: externalBooking.pricing.totalAmount,
            hostPayout: externalBooking.pricing.hostPayout,
            channelFees: externalBooking.pricing.channelFees,
            lastSyncAt: now,
            updatedAt: now,
          })
          .where(eq(channelBookings.id, existing.id));

        stats.skipped++;
      } else {
        // Create new channel booking
        const channelBookingId = `chbk_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;

        await db.insert(channelBookings).values({
          id: channelBookingId,
          tenantId: connection.tenantId,
          connectionId: connection.id,
          listingId: listing.id,
          bookingId: null,
          externalBookingId: externalBooking.id,
          externalReservationCode: externalBooking.confirmationCode || null,
          externalStatus: externalBooking.status,
          guestName: externalBooking.guest.name,
          guestEmail: externalBooking.guest.email || null,
          guestPhone: externalBooking.guest.phone || null,
          guestCount: externalBooking.guest.guestCount,
          checkInDate: externalBooking.checkInDate,
          checkOutDate: externalBooking.checkOutDate,
          nights: externalBooking.nights,
          totalAmount: externalBooking.pricing.totalAmount,
          hostPayout: externalBooking.pricing.hostPayout,
          channelFees: externalBooking.pricing.channelFees,
          currency: externalBooking.pricing.currency,
          status: 'pending',
          firstSeenAt: now,
          lastSyncAt: now,
          rawData: JSON.stringify(externalBooking),
          createdAt: now,
          updatedAt: now,
        });

        // If auto-import is enabled, create local booking
        if (connection.config?.importBookings) {
          await importChannelBooking(db, connection, listing, channelBookingId, externalBooking);
        }

        stats.succeeded++;
      }
    } catch (err) {
      stats.failed++;
      errors.push({
        item: externalBooking.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Update listing sync time
  await db
    .update(channelListings)
    .set({
      lastImportAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(channelListings.id, listing.id));

  return {
    ...stats,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Import a channel booking as a local booking
 */
async function importChannelBooking(
  db: any,
  connection: any,
  listing: any,
  channelBookingId: string,
  externalBooking: any
): Promise<void> {
  const now = new Date().toISOString();

  // Find or create guest
  let guestId: string;

  if (externalBooking.guest.email) {
    const [existingGuest] = await db
      .select()
      .from(guests)
      .where(
        and(
          eq(guests.tenantId, connection.tenantId),
          eq(guests.email, externalBooking.guest.email)
        )
      )
      .limit(1);

    if (existingGuest) {
      guestId = existingGuest.id;
    } else {
      guestId = `gst_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
      const nameParts = externalBooking.guest.name.split(' ');
      const firstName = nameParts[0] || 'Guest';
      const lastName = nameParts.slice(1).join(' ') || '';

      await db.insert(guests).values({
        id: guestId,
        tenantId: connection.tenantId,
        firstName,
        lastName,
        email: externalBooking.guest.email,
        phone: externalBooking.guest.phone || null,
        totalBookings: 0,
        totalSpent: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  } else {
    // Create anonymous guest
    guestId = `gst_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
    await db.insert(guests).values({
      id: guestId,
      tenantId: connection.tenantId,
      firstName: externalBooking.guest.name,
      lastName: '',
      email: null,
      phone: externalBooking.guest.phone || null,
      totalBookings: 0,
      totalSpent: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create local booking
  const bookingId = `bk_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const bookingRef = `CH-${externalBooking.confirmationCode || externalBooking.id.substring(0, 8).toUpperCase()}`;

  await db.insert(bookings).values({
    id: bookingId,
    tenantId: connection.tenantId,
    propertyId: listing.propertyId,
    unitId: listing.unitId,
    guestId,
    bookingRef,
    source: connection.channel,
    status: 'confirmed',
    paymentStatus: 'paid',
    checkInDate: externalBooking.checkInDate,
    checkOutDate: externalBooking.checkOutDate,
    numGuests: externalBooking.guest.guestCount,
    numAdults: externalBooking.guest.guestCount,
    numChildren: 0,
    totalAmount: externalBooking.pricing.totalAmount,
    amountPaid: externalBooking.pricing.hostPayout,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // Link channel booking to local booking
  await db
    .update(channelBookings)
    .set({
      bookingId,
      status: 'imported',
      importedAt: now,
      updatedAt: now,
    })
    .where(eq(channelBookings.id, channelBookingId));

  // Create availability block
  const blockId = `blk_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  await db.insert(availabilityBlocks).values({
    id: blockId,
    tenantId: connection.tenantId,
    unitId: listing.unitId,
    startDate: externalBooking.checkInDate,
    endDate: externalBooking.checkOutDate,
    blockType: 'booked',
    reason: `Booking from ${connection.channel}`,
    bookingId,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`✓ Imported booking ${externalBooking.id} as ${bookingId}`);
}
