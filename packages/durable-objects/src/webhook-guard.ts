/**
 * WebhookGuard Durable Object
 *
 * Ensures webhook idempotency by tracking processed events.
 * Each tenant+provider combination has its own WebhookGuard instance.
 *
 * Features:
 * - Deduplication of webhook events
 * - In-progress tracking to prevent concurrent processing
 * - Event status storage for debugging
 * - Automatic cleanup of old events
 */

interface EventRecord {
  eventId: string;
  eventType: string;
  status: 'processing' | 'processed' | 'failed';
  receivedAt: number;
  processedAt?: number;
  errorMessage?: string;
}

interface DedupeRequest {
  eventId: string;
  eventType: string;
}

interface CompleteRequest {
  eventId: string;
  success: boolean;
  errorMessage?: string;
}

// How long to keep event records (default: 7 days)
const DEFAULT_RETENTION_HOURS = 24 * 7;

export class WebhookGuard implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.slice(1);

    try {
      switch (action) {
        case 'dedupe':
          return this.checkAndMarkProcessing(request);
        case 'complete':
          return this.markCompleted(request);
        case 'status':
          return this.getEventStatus(request);
        case 'cleanup':
          return this.cleanupOldEvents();
        case 'stats':
          return this.getStats();
        default:
          // Legacy: direct call for backwards compatibility
          return this.legacyDedupe(request);
      }
    } catch (error) {
      console.error('WebhookGuard error:', error);
      return Response.json(
        { success: false, error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500 }
      );
    }
  }

  /**
   * Legacy dedupe for backwards compatibility
   */
  private async legacyDedupe(request: Request): Promise<Response> {
    const { eventId } = (await request.json()) as { eventId: string; eventType?: string };

    const key = `event:${eventId}`;
    const processed = await this.state.storage.get<boolean>(key);

    if (processed) {
      return Response.json({ processed: true, duplicate: true });
    }

    await this.state.storage.put(key, true);

    // Set cleanup alarm (7 days)
    const cleanupTime = Date.now() + DEFAULT_RETENTION_HOURS * 60 * 60 * 1000;
    await this.state.storage.put(`cleanup:${eventId}`, cleanupTime);

    return Response.json({ processed: false, duplicate: false });
  }

  /**
   * Check if an event has been processed, and if not, mark it as processing.
   */
  private async checkAndMarkProcessing(request: Request): Promise<Response> {
    const body = await request.json() as DedupeRequest;
    const { eventId, eventType } = body;

    if (!eventId) {
      return Response.json({ success: false, error: 'eventId is required' }, { status: 400 });
    }

    const key = `record:${eventId}`;
    const existing = await this.state.storage.get<EventRecord>(key);

    if (existing) {
      if (existing.status === 'processing') {
        // Check if processing is stale (> 5 minutes)
        const processingAge = Date.now() - existing.receivedAt;
        if (processingAge > 5 * 60 * 1000) {
          // Stale processing, allow retry
          existing.receivedAt = Date.now();
          await this.state.storage.put(key, existing);
          return Response.json({
            success: true,
            shouldProcess: true,
            reason: 'stale_processing_retry',
          });
        }

        return Response.json({
          success: true,
          shouldProcess: false,
          status: existing.status,
          reason: 'already_processing',
        });
      }

      if (existing.status === 'processed') {
        return Response.json({
          success: true,
          shouldProcess: false,
          status: existing.status,
          reason: 'already_processed',
          processedAt: existing.processedAt,
        });
      }

      if (existing.status === 'failed') {
        // Allow retry for failed events
        existing.status = 'processing';
        existing.receivedAt = Date.now();
        existing.errorMessage = undefined;
        await this.state.storage.put(key, existing);
        return Response.json({
          success: true,
          shouldProcess: true,
          reason: 'retry_after_failure',
        });
      }
    }

    // New event - mark as processing
    const record: EventRecord = {
      eventId,
      eventType: eventType || 'unknown',
      status: 'processing',
      receivedAt: Date.now(),
    };

    await this.state.storage.put(key, record);

    // Set cleanup time
    await this.state.storage.put(`cleanup:${eventId}`, Date.now() + DEFAULT_RETENTION_HOURS * 60 * 60 * 1000);

    // Schedule cleanup alarm
    await this.scheduleCleanupAlarm();

    return Response.json({
      success: true,
      shouldProcess: true,
      reason: 'new_event',
    });
  }

  /**
   * Mark an event as completed (success or failure).
   */
  private async markCompleted(request: Request): Promise<Response> {
    const body = await request.json() as CompleteRequest;
    const { eventId, success, errorMessage } = body;

    if (!eventId) {
      return Response.json({ success: false, error: 'eventId is required' }, { status: 400 });
    }

    const key = `record:${eventId}`;
    const record = await this.state.storage.get<EventRecord>(key);

    if (!record) {
      return Response.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    record.status = success ? 'processed' : 'failed';
    record.processedAt = Date.now();
    if (errorMessage) {
      record.errorMessage = errorMessage;
    }

    await this.state.storage.put(key, record);

    return Response.json({ success: true, status: record.status });
  }

  /**
   * Get the status of a specific event.
   */
  private async getEventStatus(request: Request): Promise<Response> {
    const body = await request.json() as { eventId: string };
    const { eventId } = body;

    if (!eventId) {
      return Response.json({ success: false, error: 'eventId is required' }, { status: 400 });
    }

    const key = `record:${eventId}`;
    const record = await this.state.storage.get<EventRecord>(key);

    if (!record) {
      // Check legacy format
      const legacyKey = `event:${eventId}`;
      const legacyProcessed = await this.state.storage.get<boolean>(legacyKey);
      if (legacyProcessed) {
        return Response.json({
          success: true,
          found: true,
          event: { eventId, status: 'processed' },
        });
      }
      return Response.json({ success: true, found: false });
    }

    return Response.json({
      success: true,
      found: true,
      event: {
        eventId: record.eventId,
        eventType: record.eventType,
        status: record.status,
        receivedAt: record.receivedAt,
        processedAt: record.processedAt,
        errorMessage: record.errorMessage,
      },
    });
  }

  /**
   * Clean up old events.
   */
  private async cleanupOldEvents(): Promise<Response> {
    const now = Date.now();
    let cleaned = 0;

    const entries = await this.state.storage.list<number>({ prefix: 'cleanup:' });

    for (const [key, cleanupTime] of entries) {
      if (cleanupTime <= now) {
        const eventId = key.replace('cleanup:', '');
        await this.state.storage.delete(`event:${eventId}`);
        await this.state.storage.delete(`record:${eventId}`);
        await this.state.storage.delete(key);
        cleaned++;
      }
    }

    return Response.json({ success: true, cleaned });
  }

  /**
   * Get statistics about stored events.
   */
  private async getStats(): Promise<Response> {
    const records = await this.state.storage.list<EventRecord>({ prefix: 'record:' });
    const legacyEvents = await this.state.storage.list<boolean>({ prefix: 'event:' });

    let processing = 0;
    let processed = 0;
    let failed = 0;

    for (const record of records.values()) {
      switch (record.status) {
        case 'processing':
          processing++;
          break;
        case 'processed':
          processed++;
          break;
        case 'failed':
          failed++;
          break;
      }
    }

    // Add legacy events as processed
    processed += legacyEvents.size;

    return Response.json({
      success: true,
      stats: {
        total: records.size + legacyEvents.size,
        processing,
        processed,
        failed,
      },
    });
  }

  /**
   * Schedule a cleanup alarm to run daily.
   */
  private async scheduleCleanupAlarm(): Promise<void> {
    const currentAlarm = await this.state.storage.getAlarm();
    if (currentAlarm) return; // Already scheduled

    // Schedule for 24 hours from now
    await this.state.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
  }

  /**
   * Alarm handler - clean up old events.
   */
  async alarm(): Promise<void> {
    const now = Date.now();
    const entries = await this.state.storage.list<number>({ prefix: 'cleanup:' });

    for (const [key, cleanupTime] of entries) {
      if (cleanupTime <= now) {
        const eventId = key.replace('cleanup:', '');
        await this.state.storage.delete(`event:${eventId}`);
        await this.state.storage.delete(`record:${eventId}`);
        await this.state.storage.delete(key);
      }
    }

    // Schedule next cleanup
    await this.state.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
  }
}
