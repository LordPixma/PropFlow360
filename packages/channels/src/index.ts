export * from './types';
export { AirbnbProvider } from './providers/airbnb';
export { BookingComProvider } from './providers/booking-com';
export { ICalProvider } from './providers/ical';

import type { ChannelProvider, ChannelConfig } from './types';
import { AirbnbProvider } from './providers/airbnb';
import { BookingComProvider } from './providers/booking-com';
import { ICalProvider } from './providers/ical';

/**
 * Create a channel provider instance
 */
export function createChannelProvider(
  channel: string,
  config: ChannelConfig
): ChannelProvider {
  switch (channel) {
    case 'airbnb':
      return new AirbnbProvider(config);
    case 'booking_com':
      return new BookingComProvider(config);
    case 'ical':
      return new ICalProvider(config);
    default:
      throw new Error(`Unknown channel: ${channel}`);
  }
}
