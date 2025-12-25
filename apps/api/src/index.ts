import { createApp } from './app';
import type { Env } from './lib/bindings';

const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;

// Export Durable Object classes
export { UnitLock } from '@propflow360/durable-objects';
export { WebhookGuard } from '@propflow360/durable-objects';
export { TenantRateLimit } from '@propflow360/durable-objects';
