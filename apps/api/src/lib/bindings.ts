export interface Env {
  // D1 Databases
  DB_CORE: D1Database;
  DB_AUDIT: D1Database;

  // KV Namespaces
  KV_CONFIG: KVNamespace;
  KV_CACHE: KVNamespace;
  KV_SESSIONS: KVNamespace;

  // R2 Buckets
  R2_MEDIA: R2Bucket;
  R2_DOCS: R2Bucket;
  R2_EXPORTS: R2Bucket;

  // Durable Objects
  DO_UNIT_LOCK: DurableObjectNamespace;
  DO_WEBHOOK_GUARD: DurableObjectNamespace;
  DO_RATE_LIMIT: DurableObjectNamespace;

  // Queues
  Q_NOTIFICATIONS: Queue;
  Q_BILLING: Queue;
  Q_CALSYNC: Queue;

  // Environment Variables
  ENV: string;
  APP_BASE_URL: string;
  API_BASE_URL: string;

  // Secrets (set via wrangler secret put)
  JWT_SIGNING_KEY: string;
  SESSION_ENC_KEY: string;
  PAYMENTS_PROVIDER?: string;
  PAYMENTS_API_KEY?: string;
  PAYMENTS_WEBHOOK_SECRET?: string;
  EMAIL_PROVIDER_KEY?: string;
  SMS_PROVIDER_KEY?: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    env: Env;
  }
}
