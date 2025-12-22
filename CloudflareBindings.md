Below is a **detailed Cloudflare bindings plan** for PropFlow360 with **exact names**, **resource layout**, and **Wrangler examples** for **dev / staging / prod**.

---

# Cloudflare Bindings Plan (PropFlow360)

## Naming conventions

**Project slug:** `propflow360`

**Environment suffixes**

* `-dev`
* `-stg`
* `-prod`

**Binding name style**

* **D1**: `DB_*`
* **KV**: `KV_*`
* **R2**: `R2_*`
* **Durable Objects**: `DO_*` (binding) + `class_name` (code)
* **Queues**: `Q_*`
* **Services** (Workers-to-Workers): `SVC_*` (optional)

---

## 1) D1 Databases

### D1 bindings

* `DB_CORE` — primary relational database (multi-tenant tables)
* `DB_AUDIT` — audit logs + security events (kept separate for retention / performance)

**Physical names**

* `propflow360-core-dev | propflow360-core-stg | propflow360-core-prod`
* `propflow360-audit-dev | propflow360-audit-stg | propflow360-audit-prod`

**What goes where**

* `DB_CORE`: tenants, users, roles, properties, units, bookings, leases, invoices, payments refs, availability blocks, tasks, messages metadata
* `DB_AUDIT`: admin actions, auth events, permission changes, webhook receipts (idempotency), system incidents

---

## 2) KV Namespaces

### KV bindings

* `KV_CONFIG` — feature flags, tenant config, plan limits, toggles
* `KV_CACHE` — cache for hot reads (property summaries, availability snapshots)
* `KV_SESSIONS` — lightweight session state (if you don’t store sessions in DO/D1)

**Physical names**

* `propflow360-config-*`
* `propflow360-cache-*`
* `propflow360-sessions-*`

**Rules**

* Never store secrets in KV
* Keep cache keys namespaced by tenant: `t:{tenantId}:...`

---

## 3) R2 Buckets

### R2 bindings

* `R2_MEDIA` — property photos, floorplans, thumbnails
* `R2_DOCS` — agreements, invoices PDFs, ID docs (if allowed), check-in docs
* `R2_EXPORTS` — report exports (CSV/Excel), analytics dumps, scheduled exports

**Physical bucket names**

* `propflow360-media-*`
* `propflow360-docs-*`
* `propflow360-exports-*`

**Access pattern**

* All buckets private; access via **signed URLs** created by Workers
* Store objects under tenant prefixes:

  * `tenants/{tenantId}/properties/{propertyId}/...`

---

## 4) Durable Objects (DO)

Durable Objects handle **concurrency**, **idempotency**, and **real-time state**.

### DO bindings (recommended)

1. `DO_UNIT_LOCK` → `class_name = UnitLock`

   * Purpose: **prevent double booking** per unit
   * One DO instance per `unitId` (ID = `unit:{unitId}`)

2. `DO_WEBHOOK_GUARD` → `class_name = WebhookGuard`

   * Purpose: **webhook idempotency** + dedupe (payment webhooks, calendar sync callbacks)
   * One DO instance per provider+tenant (ID = `wh:{provider}:{tenantId}`)

3. `DO_RATE_LIMIT` → `class_name = TenantRateLimit`

   * Purpose: tenant-aware throttling (expensive endpoints, sync endpoints)
   * ID = `rl:{tenantId}`

4. `DO_PRESENCE` → `class_name = RealtimePresence` (optional)

   * Purpose: live ops dashboards, “currently editing calendar” indicators
   * ID = `rt:{tenantId}` or `rt:{tenantId}:{propertyId}`

> If you want minimal DO footprint, start with **UnitLock** + **WebhookGuard** only.

---

## 5) Queues

### Queue bindings

**Producer bindings (API worker)**

* `Q_NOTIFICATIONS` — email/SMS/push dispatch jobs
* `Q_BILLING` — invoice generation, reminders, reconciliation tasks
* `Q_CALSYNC` — external calendar/channel sync jobs (pull/push)

**Consumer workers**

* `propflow360-worker-notify-*`
* `propflow360-worker-billing-*`
* `propflow360-worker-calsync-*`

**Routing**

* Main API Worker enqueues jobs.
* Specialized consumer Workers process them (keeps API latency low).

---

## 6) Recommended Worker structure (Cloudflare-native)

You can do this as either a monolith Worker or multiple Workers. This plan assumes **4 Workers**:

1. **API Worker**

* Name: `propflow360-api-*`
* Handles: REST/GraphQL API, auth, tenancy, core logic
* Bindings: D1, KV, R2, DO, Queues producers

2. **Notify Consumer Worker**

* Name: `propflow360-worker-notify-*`
* Consumes: `Q_NOTIFICATIONS`

3. **Billing Consumer Worker**

* Name: `propflow360-worker-billing-*`
* Consumes: `Q_BILLING`

4. **Calendar Sync Consumer Worker**

* Name: `propflow360-worker-calsync-*`
* Consumes: `Q_CALSYNC`

---

# Example Wrangler Configs

## A) `wrangler.toml` (API Worker)

```toml
name = "propflow360-api-dev"
main = "src/index.ts"
compatibility_date = "2025-12-22"

# Routes (example)
routes = [
  { pattern = "api-dev.propflow360.com/*", zone_name = "propflow360.com" }
]

# ---------------- D1 ----------------
[[d1_databases]]
binding = "DB_CORE"
database_name = "propflow360-core-dev"
database_id = "REPLACE_WITH_D1_ID"

[[d1_databases]]
binding = "DB_AUDIT"
database_name = "propflow360-audit-dev"
database_id = "REPLACE_WITH_D1_ID"

# ---------------- KV ----------------
[[kv_namespaces]]
binding = "KV_CONFIG"
id = "REPLACE_WITH_KV_ID"

[[kv_namespaces]]
binding = "KV_CACHE"
id = "REPLACE_WITH_KV_ID"

[[kv_namespaces]]
binding = "KV_SESSIONS"
id = "REPLACE_WITH_KV_ID"

# ---------------- R2 ----------------
[[r2_buckets]]
binding = "R2_MEDIA"
bucket_name = "propflow360-media-dev"

[[r2_buckets]]
binding = "R2_DOCS"
bucket_name = "propflow360-docs-dev"

[[r2_buckets]]
binding = "R2_EXPORTS"
bucket_name = "propflow360-exports-dev"

# ---------------- Durable Objects ----------------
[durable_objects]
bindings = [
  { name = "DO_UNIT_LOCK", class_name = "UnitLock" },
  { name = "DO_WEBHOOK_GUARD", class_name = "WebhookGuard" },
  { name = "DO_RATE_LIMIT", class_name = "TenantRateLimit" },
  { name = "DO_PRESENCE", class_name = "RealtimePresence" }
]

[[migrations]]
tag = "v1"
new_classes = ["UnitLock", "WebhookGuard", "TenantRateLimit", "RealtimePresence"]

# ---------------- Queues (producers) ----------------
[[queues.producers]]
binding = "Q_NOTIFICATIONS"
queue = "propflow360-notifications-dev"

[[queues.producers]]
binding = "Q_BILLING"
queue = "propflow360-billing-dev"

[[queues.producers]]
binding = "Q_CALSYNC"
queue = "propflow360-calsync-dev"

# ---------------- Vars (non-secret) ----------------
[vars]
ENV = "dev"
APP_BASE_URL = "https://app-dev.propflow360.com"
API_BASE_URL = "https://api-dev.propflow360.com"

# IMPORTANT: secrets set via `wrangler secret put ...`
```

## B) `wrangler.toml` (Notify Consumer Worker)

```toml
name = "propflow360-worker-notify-dev"
main = "src/consumer-notify.ts"
compatibility_date = "2025-12-22"

[[queues.consumers]]
queue = "propflow360-notifications-dev"
max_batch_size = 10
max_batch_timeout = 5

[[d1_databases]]
binding = "DB_CORE"
database_name = "propflow360-core-dev"
database_id = "REPLACE_WITH_D1_ID"

[[kv_namespaces]]
binding = "KV_CONFIG"
id = "REPLACE_WITH_KV_ID"
```

## C) Staging & Prod

Repeat the same pattern with environment-specific names:

* API Worker:

  * `propflow360-api-stg`, routes `api-stg.propflow360.com/*`
  * `propflow360-api-prod`, routes `api.propflow360.com/*`
* D1:

  * `propflow360-core-stg`, `propflow360-core-prod`
* KV:

  * `propflow360-config-stg`, `propflow360-config-prod`
* R2:

  * `propflow360-media-stg`, `propflow360-media-prod`
* Queues:

  * `propflow360-notifications-stg`, `propflow360-notifications-prod`

---

# Secrets (set with Wrangler)

These are **not bindings** but are essential to define per environment:

**Payments**

* `PAYMENTS_PROVIDER` (e.g., `"stripe"`)
* `PAYMENTS_API_KEY`
* `PAYMENTS_WEBHOOK_SECRET`

**Email/SMS**

* `EMAIL_PROVIDER_KEY`
* `SMS_PROVIDER_KEY`

**Auth / Tokens**

* `JWT_SIGNING_KEY`
* `SESSION_ENC_KEY`

**Operational**

* `SENTRY_DSN` (optional)
* `INTERNAL_ADMIN_TOKEN` (if needed for internal endpoints)

---

# Minimum viable binding set (if you want to start lean)

**API Worker**

* D1: `DB_CORE`
* KV: `KV_CONFIG`, `KV_CACHE`
* R2: `R2_MEDIA`
* DO: `DO_UNIT_LOCK`, `DO_WEBHOOK_GUARD`
* Queues: `Q_NOTIFICATIONS`

Then add `DB_AUDIT`, `R2_DOCS`, `R2_EXPORTS`, `Q_BILLING`, `Q_CALSYNC` as you expand.
