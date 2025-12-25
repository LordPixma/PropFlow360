# PropFlow360 - Cloudflare Deployment Guide

Complete guide to deploying PropFlow360 to Cloudflare's edge infrastructure.

## Architecture Overview

PropFlow360 consists of:
- **1 API Worker** (`apps/api`) - Main REST API
- **3 Background Workers** - Cron-based workers for async tasks:
  - `worker-notify` - Notification processing (every minute)
  - `worker-channel-sync` - Channel synchronization (every 15 minutes)
  - `worker-analytics` - Analytics aggregation (daily at 1 AM UTC)
- **1 Frontend App** (`apps/web`) - Remix app on Cloudflare Pages
- **3 Durable Objects** - Stateful coordination (UnitLock, WebhookGuard, TenantRateLimit)
- **2 D1 Databases** - SQLite databases (core, audit)
- **3 KV Namespaces** - Key-value stores (config, cache, sessions)
- **3 R2 Buckets** - Object storage (media, docs, exports)
- **3 Queues** - Message queues (notifications, billing, calsync)

## Prerequisites

1. **Cloudflare Account** with Workers Paid plan ($5/month minimum)
2. **Wrangler CLI** installed globally:
   ```bash
   npm install -g wrangler
   ```
3. **Authenticated with Cloudflare**:
   ```bash
   wrangler login
   ```

## Step 1: Create D1 Databases

Create the two D1 databases:

```bash
# Core database
wrangler d1 create propflow360-core-dev
# Note the database_id from output

# Audit database
wrangler d1 create propflow360-audit-dev
# Note the database_id from output
```

**Update the database IDs** in all `wrangler.toml` files:
- `apps/api/wrangler.toml`
- `apps/worker-notify/wrangler.toml`
- `apps/worker-channel-sync/wrangler.toml`
- `apps/worker-analytics/wrangler.toml`

Replace `REPLACE_WITH_D1_ID` or `your-d1-database-id` with the actual IDs.

## Step 2: Run Database Migrations

Run all migrations to set up the database schema:

```bash
cd apps/api

# Run migrations for core database
wrangler d1 execute propflow360-core-dev --file=../../packages/db/migrations/0001_init.sql
wrangler d1 execute propflow360-core-dev --file=../../packages/db/migrations/0002_calendar.sql
wrangler d1 execute propflow360-core-dev --file=../../packages/db/migrations/0003_bookings_leases.sql
wrangler d1 execute propflow360-core-dev --file=../../packages/db/migrations/0004_payments.sql
wrangler d1 execute propflow360-core-dev --file=../../packages/db/migrations/0005_operations.sql
wrangler d1 execute propflow360-core-dev --file=../../packages/db/migrations/0006_cleaning.sql
wrangler d1 execute propflow360-core-dev --file=../../packages/db/migrations/0007_notifications.sql
wrangler d1 execute propflow360-core-dev --file=../../packages/db/migrations/0008_channels.sql
wrangler d1 execute propflow360-core-dev --file=../../packages/db/migrations/0009_analytics.sql
wrangler d1 execute propflow360-core-dev --file=../../packages/db/migrations/0010_admin.sql

# Run migrations for audit database (if you have separate audit migrations)
# wrangler d1 execute propflow360-audit-dev --file=../../packages/db/migrations/audit.sql
```

## Step 3: Create KV Namespaces

Create the three KV namespaces:

```bash
# Config namespace
wrangler kv:namespace create "KV_CONFIG" --preview=false
# Note the id from output

# Cache namespace
wrangler kv:namespace create "KV_CACHE" --preview=false
# Note the id from output

# Sessions namespace
wrangler kv:namespace create "KV_SESSIONS" --preview=false
# Note the id from output
```

**Update the KV IDs** in `apps/api/wrangler.toml`:
Replace `REPLACE_WITH_KV_ID` with the actual IDs for each namespace.

## Step 4: Create R2 Buckets

Create the three R2 buckets:

```bash
# Media bucket
wrangler r2 bucket create propflow360-media-dev

# Docs bucket
wrangler r2 bucket create propflow360-docs-dev

# Exports bucket
wrangler r2 bucket create propflow360-exports-dev
```

**Note:** R2 bucket names are already configured in `wrangler.toml` files.

## Step 5: Create Queues

Create the three message queues:

```bash
# Notifications queue
wrangler queues create propflow360-notifications-dev

# Billing queue
wrangler queues create propflow360-billing-dev

# Calendar sync queue
wrangler queues create propflow360-calsync-dev
```

## Step 6: Set Environment Variables

Set all required secrets for the API worker:

```bash
cd apps/api

# JWT signing key (generate a random 32-byte hex string)
wrangler secret put JWT_SIGNING_KEY
# Paste a secure random string (e.g., output of: openssl rand -hex 32)

# Session encryption key (generate a random 32-byte hex string)
wrangler secret put SESSION_ENC_KEY
# Paste a secure random string

# Payment provider API keys (if using Stripe/Adyen)
wrangler secret put STRIPE_SECRET_KEY
# Paste your Stripe secret key (optional)

wrangler secret put ADYEN_API_KEY
# Paste your Adyen API key (optional)

# Resend API key for email notifications
wrangler secret put RESEND_API_KEY
# Paste your Resend API key

# Twilio credentials for SMS (optional)
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_FROM_NUMBER
```

Set secrets for notification worker:

```bash
cd apps/worker-notify

wrangler secret put RESEND_API_KEY
# Paste your Resend API key

# Optional: Twilio for SMS
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_FROM_NUMBER
```

## Step 7: Update Environment Variables

Update the `[vars]` section in `apps/api/wrangler.toml`:

```toml
[vars]
ENV = "production"
APP_BASE_URL = "https://propflow360.pages.dev"  # Or your custom domain
API_BASE_URL = "https://api.propflow360.com"    # Or your worker URL
```

## Step 8: Deploy Workers

Deploy all workers in the correct order:

### 8.1 Deploy API Worker (with Durable Objects)

```bash
cd apps/api
npm run build
wrangler deploy
```

This will:
- Deploy the main API worker
- Register the Durable Objects (UnitLock, WebhookGuard, TenantRateLimit)
- Create the migration for Durable Objects

**Note the worker URL** from the output (e.g., `https://propflow360-api-dev.your-subdomain.workers.dev`)

### 8.2 Deploy Background Workers

```bash
# Notification worker
cd apps/worker-notify
npm run build
wrangler deploy

# Channel sync worker
cd apps/worker-channel-sync
npm run build
wrangler deploy

# Analytics worker
cd apps/worker-analytics
npm run build
wrangler deploy
```

## Step 9: Deploy Frontend to Cloudflare Pages

### Option A: Deploy via Wrangler

```bash
cd apps/web

# Build the app
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy ./build/client --project-name=propflow360
```

### Option B: Connect GitHub Repository

1. Go to **Cloudflare Dashboard** → **Pages**
2. Click **Create a project**
3. Connect your GitHub repository: `LordPixma/PropFlow360`
4. Configure build settings:
   - **Framework preset**: Remix
   - **Build command**: `cd apps/web && npm run build`
   - **Build output directory**: `apps/web/build/client`
   - **Root directory**: `/` (monorepo root)
5. Set environment variables:
   - `API_URL`: Your API worker URL (e.g., `https://propflow360-api-dev.your-subdomain.workers.dev`)
6. Click **Save and Deploy**

## Step 10: Configure Custom Domains (Optional)

### For API Worker

1. Go to **Workers & Pages** → **propflow360-api-dev** → **Triggers** → **Custom Domains**
2. Add custom domain: `api.propflow360.com`
3. Cloudflare will automatically provision SSL certificate

Update `apps/api/wrangler.toml`:
```toml
routes = [
  { pattern = "api.propflow360.com/*", zone_name = "propflow360.com" }
]
```

Redeploy:
```bash
cd apps/api
wrangler deploy
```

### For Frontend (Cloudflare Pages)

1. Go to **Pages** → **propflow360** → **Custom domains**
2. Add custom domain: `propflow360.com` or `app.propflow360.com`
3. Update DNS records as instructed

## Step 11: Verify Deployment

### Test API Worker

```bash
# Health check
curl https://your-api-worker-url.workers.dev/health

# Expected response:
# {"status":"ok","timestamp":"2024-12-25T..."}
```

### Test Frontend

1. Open your Cloudflare Pages URL in browser
2. Navigate to login page
3. Create a test account
4. Verify all pages load correctly

### Test Background Workers

Check worker logs:

```bash
# Notification worker logs
wrangler tail propflow360-worker-notify --format pretty

# Channel sync worker logs
wrangler tail propflow360-worker-channel-sync --format pretty

# Analytics worker logs
wrangler tail propflow360-worker-analytics --format pretty
```

## Step 12: Monitoring and Logs

### View Real-time Logs

```bash
# API worker
cd apps/api
wrangler tail --format pretty

# Specific worker
wrangler tail propflow360-worker-notify --format pretty
```

### Cloudflare Dashboard

1. Go to **Workers & Pages** → Select your worker
2. Click **Logs** tab for real-time logs
3. Click **Metrics** tab for analytics

### Analytics

Go to **Workers & Pages** → **propflow360-api-dev** → **Metrics** to see:
- Request count
- Error rate
- CPU time
- Duration

## Production Checklist

Before going to production:

- [ ] All D1 databases created and migrated
- [ ] All KV namespaces created
- [ ] All R2 buckets created
- [ ] All queues created
- [ ] All secrets set (JWT, session keys, API keys)
- [ ] Environment variables updated (production URLs)
- [ ] API worker deployed successfully
- [ ] All 3 background workers deployed
- [ ] Frontend deployed to Cloudflare Pages
- [ ] Custom domains configured (optional)
- [ ] Health checks passing
- [ ] Test account created and verified
- [ ] All features tested in production environment
- [ ] Monitoring and alerts configured

## Troubleshooting

### Worker fails to deploy

**Error: "D1 database not found"**
- Ensure database IDs in `wrangler.toml` match the created databases
- Run `wrangler d1 list` to verify database IDs

**Error: "Durable Object class not found"**
- Ensure the migration is applied: Check `[[migrations]]` in `wrangler.toml`
- Redeploy with `wrangler deploy`

### Frontend can't connect to API

**CORS errors**
- Ensure API worker has CORS middleware configured
- Check that `APP_BASE_URL` in API worker matches frontend URL

**401 Unauthorized**
- Verify JWT_SIGNING_KEY is set correctly
- Check that frontend is sending auth token in headers

### Background workers not running

**Cron triggers not firing**
- Wait a few minutes after deployment
- Check worker logs: `wrangler tail propflow360-worker-notify`
- Verify cron syntax in `wrangler.toml`

## Useful Commands

```bash
# List all D1 databases
wrangler d1 list

# List all KV namespaces
wrangler kv:namespace list

# List all R2 buckets
wrangler r2 bucket list

# List all queues
wrangler queues list

# View worker status
wrangler deployments list

# Delete a worker (careful!)
wrangler delete propflow360-api-dev

# View D1 database content
wrangler d1 execute propflow360-core-dev --command "SELECT * FROM tenants LIMIT 5"
```

## Cost Estimation

With Cloudflare Workers Paid plan ($5/month):
- **Workers**: Included (10M requests/month)
- **D1**: Free tier (5GB storage, 5M reads/day)
- **KV**: Free tier (100K reads/day, 1K writes/day)
- **R2**: Free tier (10GB storage, 10M Class A ops/month)
- **Pages**: Free tier (Unlimited requests)
- **Durable Objects**: $0.15/million requests

**Estimated monthly cost**: $5-15/month for small-medium usage

## Next Steps

1. Set up monitoring and alerting
2. Configure backup strategy for D1 databases
3. Set up CI/CD pipeline for automatic deployments
4. Implement rate limiting and DDoS protection
5. Set up error tracking (e.g., Sentry)
6. Configure analytics and metrics dashboard
7. Create staging environment for testing

## Support

For issues:
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Cloudflare Discord: https://discord.gg/cloudflaredev
- GitHub Issues: https://github.com/LordPixma/PropFlow360/issues
