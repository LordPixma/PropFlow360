/**
 * UnitLock Durable Object
 *
 * Prevents double-booking by serializing availability checks per unit.
 * Each unit has its own UnitLock instance that manages:
 * - Availability checks
 * - Temporary holds during booking flow
 * - Block confirmations
 *
 * The DO stores holds in memory with alarms for auto-expiry.
 * Actual bookings/blocks are persisted in D1 by the API layer.
 */

interface Hold {
  holdToken: string;
  startDate: string;
  endDate: string;
  expiresAt: number;
  createdAt: number;
}

interface CheckRequest {
  startDate: string;
  endDate: string;
  existingBlocks?: Array<{ startDate: string; endDate: string }>;
}

interface HoldRequest {
  startDate: string;
  endDate: string;
  ttlMinutes?: number;
  existingBlocks?: Array<{ startDate: string; endDate: string }>;
}

interface ConfirmRequest {
  holdToken: string;
}

interface ReleaseRequest {
  holdToken: string;
}

interface GetHoldsRequest {
  startDate?: string;
  endDate?: string;
}

export class UnitLock implements DurableObject {
  private state: DurableObjectState;
  private holds: Map<string, Hold> = new Map();
  private initialized: boolean = false;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load persisted holds from storage
    const storedHolds = await this.state.storage.get<Record<string, Hold>>('holds');
    if (storedHolds) {
      const now = Date.now();
      for (const [token, hold] of Object.entries(storedHolds)) {
        if (hold.expiresAt > now) {
          this.holds.set(token, hold);
        }
      }
    }

    this.initialized = true;
  }

  private async persistHolds(): Promise<void> {
    const holdsObj: Record<string, Hold> = {};
    for (const [token, hold] of this.holds) {
      holdsObj[token] = hold;
    }
    await this.state.storage.put('holds', holdsObj);
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialize();

    const url = new URL(request.url);
    const action = url.pathname.slice(1);

    try {
      switch (action) {
        case 'check':
          return this.checkAvailability(request);
        case 'hold':
          return this.createHold(request);
        case 'confirm':
          return this.confirmHold(request);
        case 'release':
          return this.releaseHold(request);
        case 'holds':
          return this.getActiveHolds(request);
        case 'cleanup':
          return this.cleanupExpiredHolds();
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('UnitLock error:', error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500 }
      );
    }
  }

  /**
   * Check if a date range is available
   * Takes into account existing blocks (from D1) and current holds
   */
  private async checkAvailability(request: Request): Promise<Response> {
    const body = await request.json() as CheckRequest;
    const { startDate, endDate, existingBlocks = [] } = body;

    if (!startDate || !endDate) {
      return Response.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 });
    }

    // Check against existing blocks from D1
    for (const block of existingBlocks) {
      if (this.datesOverlap(startDate, endDate, block.startDate, block.endDate)) {
        return Response.json({
          success: true,
          available: false,
          reason: 'blocked',
          conflictingBlock: block,
        });
      }
    }

    // Check against active holds
    const now = Date.now();
    for (const hold of this.holds.values()) {
      if (hold.expiresAt > now && this.datesOverlap(startDate, endDate, hold.startDate, hold.endDate)) {
        return Response.json({
          success: true,
          available: false,
          reason: 'held',
          holdExpiresAt: hold.expiresAt,
        });
      }
    }

    return Response.json({ success: true, available: true });
  }

  /**
   * Create a temporary hold on dates
   * Returns a hold token that must be used to confirm or release
   */
  private async createHold(request: Request): Promise<Response> {
    const body = await request.json() as HoldRequest;
    const { startDate, endDate, ttlMinutes = 15, existingBlocks = [] } = body;

    if (!startDate || !endDate) {
      return Response.json({ success: false, error: 'startDate and endDate are required' }, { status: 400 });
    }

    // Check availability first
    for (const block of existingBlocks) {
      if (this.datesOverlap(startDate, endDate, block.startDate, block.endDate)) {
        return Response.json({
          success: false,
          error: 'Dates not available',
          reason: 'blocked',
        }, { status: 409 });
      }
    }

    const now = Date.now();
    for (const hold of this.holds.values()) {
      if (hold.expiresAt > now && this.datesOverlap(startDate, endDate, hold.startDate, hold.endDate)) {
        return Response.json({
          success: false,
          error: 'Dates not available',
          reason: 'held',
        }, { status: 409 });
      }
    }

    // Create hold
    const holdToken = crypto.randomUUID();
    const expiresAt = now + ttlMinutes * 60 * 1000;

    const hold: Hold = {
      holdToken,
      startDate,
      endDate,
      expiresAt,
      createdAt: now,
    };

    this.holds.set(holdToken, hold);
    await this.persistHolds();

    // Set alarm for cleanup
    await this.scheduleNextAlarm();

    return Response.json({
      success: true,
      holdToken,
      expiresAt,
      expiresIn: ttlMinutes * 60,
    });
  }

  /**
   * Confirm a hold, removing it from the active holds
   * The API layer is responsible for persisting the actual block in D1
   */
  private async confirmHold(request: Request): Promise<Response> {
    const body = await request.json() as ConfirmRequest;
    const { holdToken } = body;

    if (!holdToken) {
      return Response.json({ success: false, error: 'holdToken is required' }, { status: 400 });
    }

    const hold = this.holds.get(holdToken);

    if (!hold) {
      return Response.json({ success: false, error: 'Hold not found' }, { status: 404 });
    }

    if (hold.expiresAt <= Date.now()) {
      this.holds.delete(holdToken);
      await this.persistHolds();
      return Response.json({ success: false, error: 'Hold expired' }, { status: 410 });
    }

    // Remove the hold
    this.holds.delete(holdToken);
    await this.persistHolds();

    return Response.json({
      success: true,
      startDate: hold.startDate,
      endDate: hold.endDate,
    });
  }

  /**
   * Release a hold without confirming (e.g., user cancelled)
   */
  private async releaseHold(request: Request): Promise<Response> {
    const body = await request.json() as ReleaseRequest;
    const { holdToken } = body;

    if (!holdToken) {
      return Response.json({ success: false, error: 'holdToken is required' }, { status: 400 });
    }

    const hold = this.holds.get(holdToken);

    if (hold) {
      this.holds.delete(holdToken);
      await this.persistHolds();
    }

    return Response.json({ success: true });
  }

  /**
   * Get all active holds, optionally filtered by date range
   */
  private async getActiveHolds(request: Request): Promise<Response> {
    const body = await request.json() as GetHoldsRequest;
    const { startDate, endDate } = body;

    const now = Date.now();
    const activeHolds: Array<Omit<Hold, 'holdToken'>> = [];

    for (const hold of this.holds.values()) {
      if (hold.expiresAt <= now) continue;

      if (startDate && endDate) {
        if (this.datesOverlap(startDate, endDate, hold.startDate, hold.endDate)) {
          activeHolds.push({
            startDate: hold.startDate,
            endDate: hold.endDate,
            expiresAt: hold.expiresAt,
            createdAt: hold.createdAt,
          });
        }
      } else {
        activeHolds.push({
          startDate: hold.startDate,
          endDate: hold.endDate,
          expiresAt: hold.expiresAt,
          createdAt: hold.createdAt,
        });
      }
    }

    return Response.json({ success: true, holds: activeHolds });
  }

  /**
   * Clean up expired holds
   */
  private async cleanupExpiredHolds(): Promise<Response> {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, hold] of this.holds) {
      if (hold.expiresAt <= now) {
        this.holds.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.persistHolds();
    }

    return Response.json({ success: true, cleaned });
  }

  /**
   * Alarm handler - clean up expired holds
   */
  async alarm(): Promise<void> {
    await this.initialize();

    const now = Date.now();
    let hasChanges = false;

    for (const [token, hold] of this.holds) {
      if (hold.expiresAt <= now) {
        this.holds.delete(token);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await this.persistHolds();
    }

    // Schedule next alarm if there are still holds
    await this.scheduleNextAlarm();
  }

  private async scheduleNextAlarm(): Promise<void> {
    if (this.holds.size === 0) return;

    // Find the earliest expiration
    let earliestExpiry = Infinity;
    for (const hold of this.holds.values()) {
      if (hold.expiresAt < earliestExpiry) {
        earliestExpiry = hold.expiresAt;
      }
    }

    if (earliestExpiry !== Infinity) {
      await this.state.storage.setAlarm(earliestExpiry);
    }
  }

  /**
   * Check if two date ranges overlap
   * Uses exclusive end dates (check-out date is not blocked)
   */
  private datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    // Using exclusive end dates: ranges [a, b) and [c, d) overlap if a < d && c < b
    return aStart < bEnd && bStart < aEnd;
  }
}
