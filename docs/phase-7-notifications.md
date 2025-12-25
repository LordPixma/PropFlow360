# Phase 7: Notifications System

**Status:** ✅ Complete

## Overview

Phase 7 implements a comprehensive, queue-based notification system for PropFlow360 that supports both email and SMS delivery. The system is designed with:

- **Queue-based architecture** - Notifications are queued in D1 and processed by a cron worker
- **Provider abstraction** - Easy to swap or add notification providers
- **Template system** - Customizable notification templates with variable substitution
- **Retry logic** - Automatic retry with configurable max attempts
- **Professional emails** - React Email templates for beautiful, responsive emails
- **Multi-channel** - Email (Resend) and SMS (Twilio) support

## Architecture

```
┌─────────────┐
│   API App   │ ─── Queue Notification ──► D1 (notifications table)
└─────────────┘                                      │
                                                     │
                                                     ▼
┌──────────────┐                           ┌─────────────────┐
│ Resend API   │ ◄───── Send Email ─────── │ worker-notify   │
└──────────────┘                           │ (Cron: 1 min)   │
                                           └─────────────────┘
┌──────────────┐                                     ▲
│ Twilio API   │ ◄───── Send SMS ───────────────────┘
└──────────────┘
```

## Components

### 1. Database Schema

**Location:** `packages/db/src/schema/notifications.ts`

Two main tables:

- **notification_templates** - Customizable templates for different events
- **notifications** - Queue/log of all notifications (pending, sent, failed)

Key features:
- Multi-tenant with `tenant_id`
- Event-based triggering (e.g., `booking_confirmed`, `payment_received`)
- Supports both email and SMS
- Scheduled sending with `scheduled_for`
- Retry tracking with `retry_count` and `max_retries`
- Provider response storage for debugging

### 2. Notification Worker

**Location:** `apps/worker-notify/`

Cloudflare Worker that runs on a cron schedule (every minute) to process the notification queue.

**Features:**
- Processes pending notifications (up to 50 at a time)
- Retries failed notifications (up to max_retries)
- Integrates with Resend for email
- Integrates with Twilio for SMS
- Updates notification status (pending → sending → sent/failed)
- Stores provider message IDs and responses

**Environment Variables:**
```bash
RESEND_API_KEY=re_xxxxx
TWILIO_ACCOUNT_SID=ACxxxxx (optional)
TWILIO_AUTH_TOKEN=xxxxx (optional)
TWILIO_FROM_NUMBER=+1xxxxx (optional)
```

**Deployment:**
```bash
cd apps/worker-notify
wrangler deploy
```

**Manual Trigger:**
```bash
curl -X POST https://your-worker.workers.dev/process
```

### 3. Notification Helper Package

**Location:** `packages/notifications/`

Provides utilities for queuing notifications:

**Functions:**
- `queueNotification(db, params)` - Queue a notification for sending
- `renderTemplate(template, variables)` - Simple {{variable}} substitution

**Constants:**
- `NotificationEvents` - Predefined event names (BOOKING_CONFIRMED, PAYMENT_RECEIVED, etc.)

**Usage Example:**
```typescript
import { queueNotification, NotificationEvents } from '@propflow360/notifications';
import { drizzle } from 'drizzle-orm/d1';

const db = drizzle(env.DB_CORE);

await queueNotification(db, {
  tenantId: 'ten_123',
  type: 'email',
  recipientEmail: 'guest@example.com',
  recipientName: 'John Doe',
  event: NotificationEvents.BOOKING_CONFIRMED,
  variables: {
    guestName: 'John Doe',
    propertyName: 'Sunset Villa',
    unitName: 'Ocean View Suite',
    checkIn: '2024-06-15',
    checkOut: '2024-06-20',
    guests: 2,
    totalAmount: '$1,250.00',
    bookingNumber: 'BK-123456',
    bookingUrl: 'https://app.propflow360.com/bookings/bk_123',
  },
  bookingId: 'bk_123',
});
```

### 4. React Email Templates

**Location:** `packages/email-templates/`

Professional, responsive email templates built with React Email.

**Templates:**
- `BookingConfirmation` - Sent when a booking is confirmed
- `PaymentReceipt` - Sent when a payment is received
- `PaymentReminder` - Sent for upcoming or overdue payments
- `MaintenanceUpdate` - Sent when a maintenance ticket is updated

**Components:**
- `Layout` - Shared layout with header, footer, and unsubscribe links

**Features:**
- Inline styles for email client compatibility
- Responsive design
- Color-coded status badges
- Professional branding

**Preview:**
```bash
cd packages/email-templates
npm run dev
```

### 5. API Routes

**Location:** `apps/api/src/routes/notifications/`

#### Notification Queue Endpoints

- `GET /notifications` - List notification history
- `GET /notifications/:id` - Get single notification
- `POST /notifications` - Queue a notification manually
- `POST /notifications/:id/cancel` - Cancel a pending notification
- `POST /notifications/:id/retry` - Retry a failed notification

#### Template Management Endpoints

- `GET /notifications/templates` - List templates
- `GET /notifications/templates/:id` - Get single template
- `POST /notifications/templates` - Create template
- `PATCH /notifications/templates/:id` - Update template
- `DELETE /notifications/templates/:id` - Delete template
- `POST /notifications/templates/:id/toggle` - Toggle active status

## Integration Examples

### Booking Confirmation (Integrated)

**File:** [apps/api/src/routes/bookings/index.ts:539-581](../../apps/api/src/routes/bookings/index.ts#L539-L581)

When a booking is confirmed, the system automatically:
1. Updates booking status to "confirmed"
2. Updates guest payment stats
3. **Queues a booking confirmation email**

The notification is queued with the booking details and sent asynchronously by the worker.

### Payment Receipt (Example)

```typescript
// After successful payment
import { queueNotification, NotificationEvents } from '@propflow360/notifications';

await queueNotification(db, {
  tenantId,
  type: 'email',
  recipientEmail: guest.email,
  recipientName: guest.fullName,
  event: NotificationEvents.PAYMENT_RECEIVED,
  variables: {
    guestName: guest.fullName,
    invoiceNumber: invoice.invoiceNumber,
    paymentDate: new Date().toLocaleDateString(),
    amount: `$${(payment.amount / 100).toFixed(2)}`,
    paymentMethod: 'Credit Card',
    description: invoice.description,
    invoiceUrl: `https://app.propflow360.com/invoices/${invoice.id}`,
  },
  invoiceId: invoice.id,
});
```

### Payment Reminder (Scheduled)

```typescript
// Schedule a payment reminder 3 days before due date
await queueNotification(db, {
  tenantId,
  type: 'email',
  recipientEmail: guest.email,
  event: NotificationEvents.PAYMENT_REMINDER,
  variables: {
    guestName: guest.fullName,
    invoiceNumber: invoice.invoiceNumber,
    dueDate: invoice.dueDate,
    amountDue: `$${(invoice.amountDue / 100).toFixed(2)}`,
    description: invoice.description,
    paymentUrl: `https://app.propflow360.com/invoices/${invoice.id}/pay`,
  },
  invoiceId: invoice.id,
  scheduledFor: new Date(invoice.dueDate.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
});
```

### Maintenance Update

```typescript
// When a maintenance ticket is updated
await queueNotification(db, {
  tenantId,
  type: 'email',
  recipientEmail: propertyOwner.email,
  event: NotificationEvents.MAINTENANCE_TICKET_ASSIGNED,
  variables: {
    recipientName: propertyOwner.name,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    propertyName: property.name,
    unitName: unit?.name,
    updateMessage: `Ticket has been assigned to ${vendor.name}`,
    assignedTo: vendor.name,
    ticketUrl: `https://app.propflow360.com/maintenance/${ticket.id}`,
  },
  maintenanceTicketId: ticket.id,
});
```

## Notification Events

Predefined event types in `NotificationEvents`:

**Booking Events:**
- `BOOKING_CONFIRMED` - Booking confirmed and paid
- `BOOKING_CANCELLED` - Booking cancelled
- `BOOKING_MODIFIED` - Booking dates/details changed
- `BOOKING_CHECK_IN_REMINDER` - Reminder before check-in
- `BOOKING_CHECK_OUT_REMINDER` - Reminder before check-out

**Payment Events:**
- `PAYMENT_RECEIVED` - Payment successfully processed
- `PAYMENT_FAILED` - Payment declined or failed
- `PAYMENT_REMINDER` - Payment due reminder
- `INVOICE_SENT` - Invoice generated and sent

**Lease Events:**
- `LEASE_CREATED` - New lease created
- `LEASE_ACTIVATED` - Lease activated
- `LEASE_TERMINATING_SOON` - Lease ending soon
- `RENT_DUE_REMINDER` - Rent payment reminder

**Operations Events:**
- `MAINTENANCE_TICKET_CREATED` - New maintenance ticket
- `MAINTENANCE_TICKET_ASSIGNED` - Ticket assigned to vendor
- `MAINTENANCE_TICKET_COMPLETED` - Ticket resolved
- `CLEANING_ASSIGNED` - Cleaning task assigned
- `CLEANING_COMPLETED` - Cleaning task completed

## Template Variables

Templates use simple `{{variableName}}` syntax for variable substitution.

### Common Variables

All templates should support:
- `{{guestName}}` or `{{recipientName}}` - Recipient's name
- `{{propertyName}}` - Property name
- `{{unitName}}` - Unit name

### Booking-specific:
- `{{bookingNumber}}` - Booking reference
- `{{checkIn}}` - Check-in date
- `{{checkOut}}` - Check-out date
- `{{guests}}` - Number of guests
- `{{totalAmount}}` - Total booking amount
- `{{bookingUrl}}` - Link to booking details

### Payment-specific:
- `{{invoiceNumber}}` - Invoice number
- `{{amount}}` or `{{amountDue}}` - Payment amount
- `{{paymentDate}}` - Date of payment
- `{{paymentMethod}}` - Payment method used
- `{{dueDate}}` - Payment due date
- `{{daysOverdue}}` - Days past due (for reminders)
- `{{invoiceUrl}}` or `{{paymentUrl}}` - Link to invoice/payment

### Maintenance-specific:
- `{{ticketNumber}}` - Ticket reference
- `{{title}}` - Issue title
- `{{status}}` - Current status
- `{{priority}}` - Priority level
- `{{updateMessage}}` - Update description
- `{{assignedTo}}` - Vendor name
- `{{ticketUrl}}` - Link to ticket

## Testing

### Test Queue Processing

```bash
# Trigger worker manually
curl -X POST https://your-worker.workers.dev/process
```

### Test Notification Creation

```bash
# Queue a test notification
curl -X POST https://api.propflow360.com/notifications \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "recipientEmail": "test@example.com",
    "recipientName": "Test User",
    "event": "booking_confirmed",
    "variables": {
      "guestName": "Test User",
      "propertyName": "Test Property",
      "unitName": "Test Unit",
      "checkIn": "2024-06-15",
      "checkOut": "2024-06-20",
      "guests": 2,
      "totalAmount": "$500.00",
      "bookingNumber": "TEST-123",
      "bookingUrl": "https://example.com"
    }
  }'
```

### View Notification History

```bash
# List all notifications
curl https://api.propflow360.com/notifications \
  -H "Authorization: Bearer your-token"

# Filter by status
curl https://api.propflow360.com/notifications?status=sent \
  -H "Authorization: Bearer your-token"
```

## Configuration

### Email Provider (Resend)

1. Sign up at [resend.com](https://resend.com)
2. Get API key from dashboard
3. Set as worker secret:
```bash
wrangler secret put RESEND_API_KEY
```

4. Verify sender domain in Resend dashboard
5. Update `from` address in [worker-notify/src/index.ts:210](../../apps/worker-notify/src/index.ts#L210)

### SMS Provider (Twilio) - Optional

1. Sign up at [twilio.com](https://twilio.com)
2. Get Account SID, Auth Token, and phone number
3. Set as worker secrets:
```bash
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_FROM_NUMBER
```

## Monitoring

### Worker Logs

```bash
wrangler tail
```

### Notification Status

Check notification status via API:
```bash
curl https://api.propflow360.com/notifications/:id \
  -H "Authorization: Bearer your-token"
```

Response includes:
- `status` - pending, sending, sent, or failed
- `sentAt` - Timestamp when sent
- `providerMessageId` - Resend/Twilio message ID
- `providerResponse` - Full provider response
- `failureReason` - Error message if failed
- `retryCount` - Number of retry attempts

### Failed Notifications

```bash
# List failed notifications
curl https://api.propflow360.com/notifications?status=failed \
  -H "Authorization: Bearer your-token"

# Retry a failed notification
curl -X POST https://api.propflow360.com/notifications/:id/retry \
  -H "Authorization: Bearer your-token"
```

## Future Enhancements

Potential improvements for future phases:

1. **Push Notifications** - Add support for mobile push via FCM/APNS
2. **In-App Notifications** - Real-time notifications in the web app
3. **Webhook Delivery** - Send notifications to external webhooks
4. **Advanced Templates** - Support for conditional logic in templates
5. **A/B Testing** - Test different template variations
6. **Analytics** - Track open rates, click rates, delivery rates
7. **Preferences** - Per-user notification preferences (opt-out, frequency)
8. **Batching** - Batch multiple notifications into digests
9. **Priority Queue** - Separate queues for urgent vs normal notifications
10. **Rate Limiting** - Per-recipient rate limiting to avoid spam

## Files Created

- `packages/db/src/schema/notifications.ts` - Schema definitions
- `packages/db/migrations/0007_notifications.sql` - Migration
- `packages/notifications/package.json` - Package config
- `packages/notifications/src/index.ts` - Helper utilities
- `packages/email-templates/package.json` - Package config
- `packages/email-templates/src/components/Layout.tsx` - Shared layout
- `packages/email-templates/src/BookingConfirmation.tsx` - Template
- `packages/email-templates/src/PaymentReceipt.tsx` - Template
- `packages/email-templates/src/PaymentReminder.tsx` - Template
- `packages/email-templates/src/MaintenanceUpdate.tsx` - Template
- `packages/email-templates/src/index.tsx` - Exports
- `apps/worker-notify/package.json` - Worker config
- `apps/worker-notify/wrangler.toml` - Cloudflare config
- `apps/worker-notify/tsconfig.json` - TypeScript config
- `apps/worker-notify/src/index.ts` - Worker implementation
- `apps/api/src/routes/notifications/index.ts` - Notification routes
- `apps/api/src/routes/notifications/templates.ts` - Template routes

## Summary

Phase 7 is now complete with a robust, production-ready notification system that:

✅ Queues notifications asynchronously in D1
✅ Processes via cron worker with retry logic
✅ Sends beautiful emails via Resend
✅ Supports SMS via Twilio
✅ Uses customizable templates with variables
✅ Integrates seamlessly into booking flow
✅ Provides comprehensive API for management
✅ Includes professional React Email templates
✅ Tracks delivery status and provider responses
✅ Supports scheduled notifications

The system is ready for production use and can be extended with additional notification types and providers as needed.
