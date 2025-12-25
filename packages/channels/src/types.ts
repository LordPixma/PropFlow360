/**
 * Channel Provider Types
 */

export interface ChannelListing {
  id: string;
  name: string;
  url?: string;
  status: 'active' | 'inactive' | 'paused';
  currency?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
}

export interface ChannelBooking {
  id: string;
  listingId: string;
  confirmationCode?: string;
  status: string;
  checkInDate: string; // ISO date
  checkOutDate: string; // ISO date
  nights: number;
  guest: {
    name: string;
    email?: string;
    phone?: string;
    guestCount: number;
  };
  pricing: {
    totalAmount: number; // In cents
    hostPayout: number; // In cents
    channelFees: number; // In cents
    currency: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChannelAvailability {
  listingId: string;
  dates: Array<{
    date: string; // ISO date
    available: boolean;
    minStay?: number;
    price?: number; // In cents
  }>;
}

export interface SyncResult<T = any> {
  success: boolean;
  data?: T;
  errors?: Array<{
    item?: string;
    error: string;
  }>;
  stats: {
    processed: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Channel Provider Interface
 * All channel integrations must implement this interface
 */
export interface ChannelProvider {
  /**
   * Provider name (e.g., 'airbnb', 'booking_com')
   */
  readonly name: string;

  /**
   * Test authentication credentials
   */
  testConnection(): Promise<boolean>;

  /**
   * Refresh OAuth tokens if needed
   */
  refreshTokens?(): Promise<void>;

  /**
   * Fetch all listings
   */
  fetchListings(): Promise<ChannelListing[]>;

  /**
   * Fetch bookings for a date range
   */
  fetchBookings(params: {
    listingIds?: string[];
    startDate?: string;
    endDate?: string;
  }): Promise<ChannelBooking[]>;

  /**
   * Fetch availability for a listing
   */
  fetchAvailability(params: {
    listingId: string;
    startDate: string;
    endDate: string;
  }): Promise<ChannelAvailability>;

  /**
   * Update availability (block/unblock dates)
   */
  updateAvailability?(params: {
    listingId: string;
    dates: Array<{
      date: string;
      available: boolean;
    }>;
  }): Promise<SyncResult>;

  /**
   * Update pricing
   */
  updatePricing?(params: {
    listingId: string;
    dates: Array<{
      date: string;
      price: number; // In cents
    }>;
  }): Promise<SyncResult>;

  /**
   * Cancel a booking
   */
  cancelBooking?(bookingId: string, reason?: string): Promise<boolean>;
}

/**
 * OAuth credentials for channel providers
 */
export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string; // ISO timestamp
  scope?: string;
}

/**
 * Channel provider configuration
 */
export interface ChannelConfig {
  credentials: OAuthCredentials | Record<string, any>;
  baseUrl?: string;
  apiVersion?: string;
  timeout?: number;
}
