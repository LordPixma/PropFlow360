# PropFlow360 — High-Level Design (HLD)

**Product:** Multi-tenant Property Management SaaS for short / medium / long lets (Airbnb-style hosts, commercial owners, studio owners, property managers managing client portfolios).
**Hosting Constraint:** **Cloudflare-only** (use Cloudflare services end-to-end wherever feasible).
**Core Requirements:** Multi-tenancy, role-based portals, **integrated payments**, **calendar & availability**, analytics, secure operations.

---

## 1) Vision and Goals

PropFlow360 centralizes property operations across booking models:

* **Short lets:** nightly bookings, check-in/out, channel sync, deposits, cleaning schedules
* **Medium lets:** monthly pricing, flexible terms, invoicing
* **Long lets:** lease periods, recurring rent, arrears tracking

### Primary Outcomes

* One platform to manage **properties, bookings, guests/tenants, payments, calendars, and operations**
* Clear separation between:

  * **Customers** (bookers/tenants/clients)
  * **Property Admins** (tenant owners / property managers / studio operators)
  * **Global Administrators** (platform ops + compliance + support)

---

## 2) Personas and Access Model

### 2.1 Personas

**A) Customers**

* Browse listings (if public), request/confirm bookings, view agreements, pay invoices, manage profile
* View calendar availability (where allowed), receive notifications

**B) Property Admins (Tenant Owners)**

* Create/manage properties, units/spaces, rates, rules, photos, availability
* Manage bookings, leases, contracts, deposits, invoices, refunds
* Manage maintenance tasks, cleaning schedules, staff/vendor assignments
* View financials, payouts, occupancy, and reports

**C) Global Administrators (Platform Admins)**

* Manage tenants (Property Admin orgs), plans, billing, feature flags
* Global analytics, audit, fraud/risk controls, support tooling
* Compliance controls, data retention policies, and incident response

### 2.2 RBAC / Permissions (High-level)

* **Org/Tenant-scoped roles:** Owner, Manager, Finance, Ops, Read-only
* **Property-scoped roles:** Property Manager, Maintenance Coordinator, Cleaner/Vendor
* **Customer roles:** Customer, Corporate Customer (optional)

---

## 3) Multi-Tenancy Model

### 3.1 Tenant Definition

A **Tenant** represents a Property Admin organisation (e.g., “Smith Stays Ltd”, “DragonCity Studios”).

### 3.2 Data Isolation Strategy (Cloudflare D1 + Access Patterns)

Recommended approach:

* **Single logical schema** with `tenant_id` on all tenant-owned tables
* **Row-level enforcement** at application layer (Workers), with strict query helpers
* Optional “hard isolation” tier:

  * **Per-tenant D1 database** for premium plans or regulated customers

### 3.3 Tenant Routing

* `tenantSlug.propflow360.com` (subdomain routing) or `app.propflow360.com/t/{tenantSlug}`
* Use Cloudflare routing + middleware to bind `tenant_id` early in request lifecycle

---

## 4) Core Capabilities

### 4.1 Property & Inventory

* Properties, units (rooms, studios, offices), amenities
* Pricing rules (seasonal, weekend, last-minute, length-of-stay)
* House rules / terms, deposits, check-in/out policies
* Media management (photos, documents)

### 4.2 Booking & Lease Management

* Short/medium: bookings, extensions, cancellations, refunds
* Long: leases, recurring invoices, arrears, late fees
* Security deposits, damage claims workflow (optional)

### 4.3 Calendar System (Critical)

* Internal availability calendar per unit/property
* Holds/blocks, maintenance blocks, owner stays
* Sync options:

  * ICS feeds (export)
  * External channel integration (future: Airbnb/Booking.com) via connectors

### 4.4 Payments (Critical)

* Card payments + bank transfer references (where supported)
* Payment intents, invoices, refunds, disputes
* Payout handling to Property Admins (if marketplace model)
* Reconciliation and ledger

> **Note:** Cloudflare doesn’t provide a native card processing product; payments will require an external PSP (e.g., Stripe/Adyen) while still keeping **all application hosting on Cloudflare**. Integration is done via Workers.

### 4.5 Operations

* Maintenance tickets, vendor assignments
* Cleaning schedules triggered by check-out
* Message templates and automated comms

### 4.6 Notifications & Messaging

* Email/SMS/push (via external providers if needed)
* Event-driven notifications: booking confirmed, payment due, access instructions, etc.

### 4.7 Reporting & Analytics

* Occupancy rate, ADR, RevPAR (short lets)
* Rent collected, arrears (long lets)
* Funnel metrics: views → enquiries → bookings → paid

---

## 5) High-Level Architecture (Cloudflare-First)

### 5.1 Components

**Frontend**

* Cloudflare Pages (marketing site + web app)
* Auth UI, dashboards, customer portal

**API Layer**

* Cloudflare Workers (REST/GraphQL)
* Tenant routing, RBAC, business logic, integrations

**Data**

* Cloudflare D1 (core relational data)
* Cloudflare R2 (documents, images, agreements)
* Cloudflare KV (fast config, feature flags, lightweight caches)
* Cloudflare Durable Objects (calendar locks, rate-limits, booking concurrency, real-time sessions)
* Cloudflare Queues (async jobs)
* Cloudflare Analytics / Logs (observability)

**Security**

* Cloudflare Access, WAF, Bot Management, Turnstile
* Rate limiting, DDoS protection, TLS, mTLS for admin APIs (optional)

---

## 6) Key Workflows

### 6.1 Customer Booking Flow

1. Customer searches availability
2. API checks calendar availability (Durable Object lock for unit)
3. Create booking “Pending Payment”
4. Create payment intent with PSP (external)
5. On payment success webhook → Workers validates signature → marks booking “Confirmed”
6. Calendar updated, notifications triggered

### 6.2 Long-Let Recurring Invoicing

1. Lease created with rent schedule
2. Cron triggers invoice generation monthly
3. Payment link generated + reminders
4. Reconciliation updates ledger + arrears flags

### 6.3 Calendar Updates / Holds

* Any write to availability uses **Durable Object per unit** to prevent double-booking
* Sync feed generation from D1, cached in KV where appropriate

---

## 7) Data Model (Logical)

Core entities:

* `tenants`
* `users`
* `roles`, `user_roles`
* `properties`
* `units` (rooms/studios/offices)
* `availability_blocks`
* `bookings` (short/medium)
* `leases` (long)
* `invoices`
* `payments` (PSP references)
* `refunds`
* `payouts` (optional marketplace)
* `maintenance_tickets`
* `vendors`
* `messages`, `notifications`
* `audit_log`

---

## 8) Integration Design

### 8.1 Payments Integration

* Workers create payment intents and store PSP IDs in D1
* Webhooks terminate at Workers endpoint:

  * Verify signature
  * Idempotency keys stored in D1 / Durable Object
  * Update booking/invoice status
* PCI scope minimized: do not store card data; use PSP-hosted UI

### 8.2 Calendar Integration

* ICS export endpoint per property/unit (tokenized)
* Internal calendar UI in Pages app (reads from API)
* Optional external calendar sync connectors via Queues + scheduled pulls

---

## 9) Security and Compliance

### 9.1 Authentication

* Cloudflare **Zero Trust Access / Access + OIDC** (recommended for Admin portals)
* Customer auth: session tokens (JWT) issued by Workers + stored in secure cookies
* MFA for Property Admins + Global Admins

### 9.2 Authorization

* RBAC enforced in Workers middleware
* Tenant boundary checks in every data access path
* Audit logs for privileged actions

### 9.3 Abuse & Fraud

* Cloudflare WAF rules, rate limits
* Turnstile on signup/login and suspicious actions
* Bot Management for scraping protection on public listings

### 9.4 Data Protection

* Encrypt secrets in Cloudflare-managed secret store (Workers secrets)
* R2 private buckets for documents
* Data retention policies per tenant plan

---

## 10) Reliability, Performance, and Scaling

* Stateless APIs via Workers scale automatically
* D1 for transactional operations; cache read-heavy data in KV
* Concurrency-critical booking updates handled by Durable Objects
* Async processing (notifications, report generation) via Queues
* Multi-region edge execution improves latency globally

---

## 11) Observability and Operations

* Structured logs from Workers
* Error tracking hooks (external) if desired
* Admin activity audit trails in D1
* Metrics: booking conversion, payment success rate, sync errors, queue backlog

---

## 12) Deployment and Environments

* Environments: `dev`, `staging`, `prod`
* CI/CD: GitHub Actions → Wrangler deploy to Workers/Pages
* Config: per-environment bindings (D1, R2, KV, DO, Queues)

---

## 13) Reference Architecture — Feature → Cloudflare Services

| Feature Area                        | Cloudflare Services                            | Notes                                        |
| ----------------------------------- | ---------------------------------------------- | -------------------------------------------- |
| Web App (Customer + Property Admin) | **Pages**                                      | Static + SPA/SSR (framework of choice)       |
| API (Core business logic)           | **Workers**                                    | REST/GraphQL, tenancy, RBAC                  |
| Authentication (Admin portal)       | **Cloudflare Access**                          | SSO/MFA for privileged users                 |
| Customer signup protection          | **Turnstile**                                  | Reduce abuse/bot signups                     |
| Multi-tenant data                   | **D1**                                         | Relational store; optional per-tenant D1     |
| File storage (photos, agreements)   | **R2**                                         | Private objects + signed URLs                |
| Fast config & caching               | **KV**                                         | Feature flags, cached availability snapshots |
| Prevent double-booking              | **Durable Objects**                            | Per-unit lock + idempotency                  |
| Background jobs                     | **Queues**                                     | Notifications, calendar sync, invoice runs   |
| Scheduled jobs                      | **Cron Triggers (Workers)**                    | Monthly invoices, reminders, clean-up        |
| Security edge controls              | **WAF**, **Rate Limiting**, **Bot Management** | Protect APIs and public pages                |
| Performance                         | **CDN / Edge Network**                         | Global caching + low latency                 |
| Analytics                           | **Cloudflare Analytics / Logs**                | Usage metrics + audit support                |

---

## 14) MVP Scope (Practical First Release)

**Must-have**

* Tenant onboarding + Property Admin portal
* Properties/units + pricing basics
* Booking + internal calendar + anti-double-booking
* Payments integration (PSP) + invoices/receipts
* Customer portal (book, pay, manage bookings)
* Notifications (email) via queue-driven worker

**Nice-to-have (Phase 2)**

* Channel manager integrations (Airbnb/Booking.com)
* Advanced pricing rules + promotions
* Maintenance workflows + vendor marketplace
* Payout splits + marketplace model
* BI dashboards and export packs

---

## 15) Open Considerations (Handled in LLD later)

* Choice of payment provider (Stripe/Adyen/etc.) and marketplace vs direct-pay model
* Data isolation tiering (shared D1 vs per-tenant D1)
* Calendar sync strategy (push vs pull, frequency, conflict handling)
* Tenant-custom domains and branding
* Regulatory posture (GDPR, data residency requirements)

