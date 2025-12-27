/**
 * iCal Channel Provider
 *
 * Generic provider for iCal feed subscriptions
 * Supports any platform that provides iCal feeds (VRBO, HomeAway, etc.)
 */

import type {
  ChannelProvider,
  ChannelListing,
  ChannelBooking,
  ChannelAvailability,
  ChannelConfig,
} from '../types';
import { parseICalFeed } from '@propflow360/ical';

export class ICalProvider implements ChannelProvider {
  readonly name = 'ical';
  private icalUrl: string;
  private listingName: string;

  constructor(config: ChannelConfig) {
    const creds = config.credentials as Record<string, string>;
    this.icalUrl = creds.icalUrl ?? '';
    this.listingName = creds.listingName ?? 'iCal Import';
  }

  /**
   * Test connection by fetching the iCal feed
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await parseICalFeed(this.icalUrl);
      return result.errors.length === 0 || result.events.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Fetch listings (single listing for iCal)
   */
  async fetchListings(): Promise<ChannelListing[]> {
    return [{
      id: 'ical_listing',
      name: this.listingName,
      status: 'active',
    }];
  }

  /**
   * Fetch bookings from iCal feed
   * iCal feeds only provide blocked dates, not full booking details
   */
  async fetchBookings(params: {
    listingIds?: string[];
    startDate?: string;
    endDate?: string;
  }): Promise<ChannelBooking[]> {
    const result = await parseICalFeed(this.icalUrl);

    const bookings: ChannelBooking[] = [];

    for (const event of result.events) {
      // Filter by date range if provided
      if (params.startDate && event.endDate < params.startDate) continue;
      if (params.endDate && event.startDate > params.endDate) continue;

      // Calculate nights
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      bookings.push({
        id: event.uid,
        listingId: 'ical_listing',
        confirmationCode: event.uid,
        status: event.status === 'CANCELLED' ? 'cancelled' : 'confirmed',
        checkInDate: event.startDate,
        checkOutDate: event.endDate,
        nights,
        guest: {
          name: event.summary || 'Blocked',
          guestCount: 1,
        },
        pricing: {
          totalAmount: 0,
          hostPayout: 0,
          channelFees: 0,
          currency: 'USD',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return bookings;
  }

  /**
   * Fetch availability from iCal feed
   */
  async fetchAvailability(params: {
    listingId: string;
    startDate: string;
    endDate: string;
  }): Promise<ChannelAvailability> {
    const result = await parseICalFeed(this.icalUrl);

    // Generate all dates in range
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    const dates: Array<{ date: string; available: boolean }> = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().substring(0, 10); // YYYY-MM-DD format

      // Check if date is blocked by any event
      const isBlocked = result.events.some(event => {
        return dateStr >= event.startDate && dateStr < event.endDate;
      });

      dates.push({
        date: dateStr,
        available: !isBlocked,
      });
    }

    return {
      listingId: params.listingId,
      dates,
    };
  }
}
