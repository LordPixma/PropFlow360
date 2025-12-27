/**
 * Airbnb Channel Provider
 *
 * Integration with Airbnb API
 * Note: This requires Airbnb API access which is limited to select partners
 */

import type {
  ChannelProvider,
  ChannelListing,
  ChannelBooking,
  ChannelAvailability,
  SyncResult,
  ChannelConfig,
} from '../types';

export class AirbnbProvider implements ChannelProvider {
  readonly name = 'airbnb';
  private accessToken: string;
  private refreshToken?: string;
  private expiresAt?: string;
  private clientId?: string;
  private clientSecret?: string;
  private readonly baseUrl = 'https://api.airbnb.com/v2';

  constructor(config: ChannelConfig) {
    const creds = config.credentials as Record<string, string>;
    this.accessToken = creds.accessToken ?? '';
    this.refreshToken = creds.refreshToken;
    this.expiresAt = creds.expiresAt;
    this.clientId = creds.clientId;
    this.clientSecret = creds.clientSecret;
  }

  /**
   * Make authenticated request to Airbnb API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Airbnb-API-Key': this.accessToken, // Airbnb uses different header
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Airbnb API error (${response.status}): ${error}`);
    }

    return response.json() as T;
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to fetch user info or listings to verify credentials
      await this.fetchListings();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Refresh OAuth tokens
   */
  async refreshTokens(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://api.airbnb.com/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Airbnb tokens');
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  }

  /**
   * Fetch all listings
   */
  async fetchListings(): Promise<ChannelListing[]> {
    const response = await this.request<{
      listings: Array<{
        id: string;
        name: string;
        url: string;
        status: string;
        currency: string;
        listing_type: string;
        bedrooms: number;
        bathrooms: number;
        max_guests: number;
        address: {
          street: string;
          city: string;
          state: string;
          country: string;
          zipcode: string;
        };
      }>;
    }>('GET', '/listings');

    return response.listings.map(listing => ({
      id: listing.id,
      name: listing.name,
      url: listing.url,
      status: listing.status === 'listed' ? 'active' : 'inactive',
      currency: listing.currency,
      propertyType: listing.listing_type,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      maxGuests: listing.max_guests,
      address: {
        street: listing.address.street,
        city: listing.address.city,
        state: listing.address.state,
        country: listing.address.country,
        postalCode: listing.address.zipcode,
      },
    }));
  }

  /**
   * Fetch bookings
   */
  async fetchBookings(params: {
    listingIds?: string[];
    startDate?: string;
    endDate?: string;
  }): Promise<ChannelBooking[]> {
    const query = new URLSearchParams();

    if (params.listingIds) {
      query.append('listing_ids', params.listingIds.join(','));
    }
    if (params.startDate) {
      query.append('start_date', params.startDate);
    }
    if (params.endDate) {
      query.append('end_date', params.endDate);
    }

    const response = await this.request<{
      reservations: Array<{
        id: string;
        listing_id: string;
        confirmation_code: string;
        status: string;
        start_date: string;
        end_date: string;
        nights: number;
        guest: {
          first_name: string;
          last_name: string;
          email: string;
          phone: string;
        };
        number_of_guests: number;
        total_paid_amount_accurate: string; // Dollar amount
        host_payout_amount_accurate: string;
        guest_service_fee_accurate: string;
        currency: string;
        created_at: string;
        updated_at: string;
      }>;
    }>('GET', `/reservations?${query}`);

    return response.reservations.map(res => ({
      id: res.id,
      listingId: res.listing_id,
      confirmationCode: res.confirmation_code,
      status: res.status,
      checkInDate: res.start_date,
      checkOutDate: res.end_date,
      nights: res.nights,
      guest: {
        name: `${res.guest.first_name} ${res.guest.last_name}`,
        email: res.guest.email,
        phone: res.guest.phone,
        guestCount: res.number_of_guests,
      },
      pricing: {
        totalAmount: Math.round(parseFloat(res.total_paid_amount_accurate) * 100),
        hostPayout: Math.round(parseFloat(res.host_payout_amount_accurate) * 100),
        channelFees: Math.round(parseFloat(res.guest_service_fee_accurate) * 100),
        currency: res.currency,
      },
      createdAt: res.created_at,
      updatedAt: res.updated_at,
    }));
  }

  /**
   * Fetch availability
   */
  async fetchAvailability(params: {
    listingId: string;
    startDate: string;
    endDate: string;
  }): Promise<ChannelAvailability> {
    const query = new URLSearchParams({
      start_date: params.startDate,
      end_date: params.endDate,
    });

    const response = await this.request<{
      calendar_days: Array<{
        date: string;
        available: boolean;
        min_nights: number;
        price: {
          amount_formatted: string;
        };
      }>;
    }>('GET', `/listings/${params.listingId}/calendar?${query}`);

    return {
      listingId: params.listingId,
      dates: response.calendar_days.map(day => ({
        date: day.date,
        available: day.available,
        minStay: day.min_nights,
        price: day.price ? Math.round(parseFloat(day.price.amount_formatted.replace(/[^0-9.]/g, '')) * 100) : undefined,
      })),
    };
  }

  /**
   * Update availability
   */
  async updateAvailability(params: {
    listingId: string;
    dates: Array<{
      date: string;
      available: boolean;
    }>;
  }): Promise<SyncResult> {
    const stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };
    const errors: Array<{ item?: string; error: string }> = [];

    try {
      await this.request('PUT', `/listings/${params.listingId}/calendar`, {
        daily_availabilities: params.dates.map(d => ({
          date: d.date,
          available: d.available,
        })),
      });

      stats.processed = params.dates.length;
      stats.succeeded = params.dates.length;

      return {
        success: true,
        stats,
      };
    } catch (err) {
      errors.push({
        error: err instanceof Error ? err.message : 'Unknown error',
      });

      return {
        success: false,
        errors,
        stats,
      };
    }
  }

  /**
   * Update pricing
   */
  async updatePricing(params: {
    listingId: string;
    dates: Array<{
      date: string;
      price: number; // In cents
    }>;
  }): Promise<SyncResult> {
    const stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };
    const errors: Array<{ item?: string; error: string }> = [];

    try {
      await this.request('PUT', `/listings/${params.listingId}/calendar`, {
        daily_prices: params.dates.map(d => ({
          date: d.date,
          price: (d.price / 100).toFixed(2), // Convert cents to dollars
        })),
      });

      stats.processed = params.dates.length;
      stats.succeeded = params.dates.length;

      return {
        success: true,
        stats,
      };
    } catch (err) {
      errors.push({
        error: err instanceof Error ? err.message : 'Unknown error',
      });

      return {
        success: false,
        errors,
        stats,
      };
    }
  }

  /**
   * Cancel booking
   */
  async cancelBooking(bookingId: string, reason?: string): Promise<boolean> {
    try {
      await this.request('POST', `/reservations/${bookingId}/cancel`, {
        cancel_reason: reason || 'Host cancelled',
      });
      return true;
    } catch {
      return false;
    }
  }
}
