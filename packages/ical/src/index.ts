/**
 * iCal Utilities for PropFlow360
 *
 * Handles parsing iCal feeds from external sources and generating
 * iCal feeds for export
 */

import ICAL from 'ical.js';

export interface ICalEvent {
  uid: string;
  summary: string;
  description?: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  url?: string;
  location?: string;
  organizer?: string;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
}

export interface ParsedICalFeed {
  events: ICalEvent[];
  calendarName?: string;
  errors: string[];
}

/**
 * Parse an iCal feed from a URL or string
 */
export async function parseICalFeed(source: string | URL): Promise<ParsedICalFeed> {
  const errors: string[] = [];
  const events: ICalEvent[] = [];
  let calendarName: string | undefined;

  try {
    // Fetch if URL
    let icalData: string;
    if (source instanceof URL || (typeof source === 'string' && source.startsWith('http'))) {
      const response = await fetch(source.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch iCal feed: ${response.statusText}`);
      }
      icalData = await response.text();
    } else {
      icalData = source;
    }

    // Parse iCal data
    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);

    // Get calendar name
    calendarName = comp.getFirstPropertyValue('x-wr-calname') ||
                   comp.getFirstPropertyValue('name');

    // Parse events
    const vevents = comp.getAllSubcomponents('vevent');

    for (const vevent of vevents) {
      try {
        const event = new ICAL.Event(vevent);

        const uid = event.uid || `imported_${crypto.randomUUID()}`;
        const summary = event.summary || 'Blocked';
        const description = event.description || '';

        // Get dates
        const startDate = event.startDate;
        const endDate = event.endDate;

        if (!startDate || !endDate) {
          errors.push(`Event ${uid}: Missing start or end date`);
          continue;
        }

        // Convert to ISO dates
        const start = startDate.toJSDate().toISOString().split('T')[0];
        const end = endDate.toJSDate().toISOString().split('T')[0];

        events.push({
          uid,
          summary,
          description,
          startDate: start,
          endDate: end,
          url: event.url,
          location: event.location,
          organizer: event.organizer,
          status: event.status as any,
        });
      } catch (err) {
        errors.push(`Failed to parse event: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  } catch (err) {
    errors.push(`Failed to parse iCal feed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return {
    events,
    calendarName,
    errors,
  };
}

export interface GenerateICalOptions {
  calendarName: string;
  productId?: string;
  timezone?: string;
  events: Array<{
    uid: string;
    summary: string;
    description?: string;
    startDate: string; // ISO date
    endDate: string; // ISO date
    url?: string;
    location?: string;
    status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
    created?: string; // ISO timestamp
    modified?: string; // ISO timestamp
  }>;
}

/**
 * Generate an iCal feed from bookings and availability blocks
 */
export function generateICalFeed(options: GenerateICalOptions): string {
  const {
    calendarName,
    productId = '-//PropFlow360//Calendar//EN',
    timezone = 'UTC',
    events,
  } = options;

  // Create calendar component
  const cal = new ICAL.Component(['vcalendar', [], []]);

  // Set calendar properties
  cal.updatePropertyWithValue('prodid', productId);
  cal.updatePropertyWithValue('version', '2.0');
  cal.updatePropertyWithValue('calscale', 'GREGORIAN');
  cal.updatePropertyWithValue('method', 'PUBLISH');
  cal.updatePropertyWithValue('x-wr-calname', calendarName);
  cal.updatePropertyWithValue('x-wr-timezone', timezone);

  // Add timezone component
  const vtimezone = new ICAL.Component('vtimezone');
  vtimezone.updatePropertyWithValue('tzid', timezone);
  cal.addSubcomponent(vtimezone);

  // Add events
  for (const eventData of events) {
    const vevent = new ICAL.Component('vevent');

    vevent.updatePropertyWithValue('uid', eventData.uid);
    vevent.updatePropertyWithValue('summary', eventData.summary);

    if (eventData.description) {
      vevent.updatePropertyWithValue('description', eventData.description);
    }

    // Create dates (all-day events)
    const dtstart = ICAL.Time.fromString(eventData.startDate);
    dtstart.isDate = true; // Mark as all-day event
    vevent.updatePropertyWithValue('dtstart', dtstart);

    const dtend = ICAL.Time.fromString(eventData.endDate);
    dtend.isDate = true;
    vevent.updatePropertyWithValue('dtend', dtend);

    if (eventData.url) {
      vevent.updatePropertyWithValue('url', eventData.url);
    }

    if (eventData.location) {
      vevent.updatePropertyWithValue('location', eventData.location);
    }

    if (eventData.status) {
      vevent.updatePropertyWithValue('status', eventData.status);
    }

    // Timestamps
    const now = ICAL.Time.now();
    vevent.updatePropertyWithValue('dtstamp', now);

    if (eventData.created) {
      const created = ICAL.Time.fromString(eventData.created);
      vevent.updatePropertyWithValue('created', created);
    }

    if (eventData.modified) {
      const modified = ICAL.Time.fromString(eventData.modified);
      vevent.updatePropertyWithValue('last-modified', modified);
    } else {
      vevent.updatePropertyWithValue('last-modified', now);
    }

    cal.addSubcomponent(vevent);
  }

  return cal.toString();
}

/**
 * Convert iCal events to availability blocks
 */
export interface AvailabilityBlock {
  startDate: string;
  endDate: string;
  blockType: 'booked';
  reason: string;
  externalId?: string;
}

export function eventsToBlocks(events: ICalEvent[]): AvailabilityBlock[] {
  return events.map(event => ({
    startDate: event.startDate,
    endDate: event.endDate,
    blockType: 'booked' as const,
    reason: event.summary,
    externalId: event.uid,
  }));
}

/**
 * Validate iCal URL
 */
export function isValidICalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'webcal:';
  } catch {
    return false;
  }
}

/**
 * Convert webcal:// to https://
 */
export function normalizeICalUrl(url: string): string {
  return url.replace(/^webcal:\/\//i, 'https://');
}
