import { Hono } from 'hono';
import type { AppEnv } from '../../lib/context';
import { generateId } from '../../lib/id';
import { invoices, payments, paymentProviders, webhookEvents, bookings } from '@propflow360/db';
import { eq, and } from 'drizzle-orm';
import { createPaymentProvider } from '@propflow360/payments';

export const webhooksRouter = new Hono<AppEnv>();

// Stripe webhook handler
webhooksRouter.post('/stripe/:tenantId', async (c) => {
  const tenantId = c.req.param('tenantId');
  const db = c.get('db');
  const env = c.env;
  const now = new Date().toISOString();

  // Get raw body for signature verification
  const payload = await c.req.text();
  const signature = c.req.header('stripe-signature');

  if (!signature) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  // Get tenant's Stripe configuration
  const [provider] = await db
    .select()
    .from(paymentProviders)
    .where(
      and(eq(paymentProviders.tenantId, tenantId), eq(paymentProviders.provider, 'stripe'))
    );

  if (!provider) {
    return c.json({ error: 'Stripe not configured for this tenant' }, 400);
  }

  const providerConfig = provider.config as {
    apiKey: string;
    webhookSecret: string;
  };

  const stripeProvider = createPaymentProvider('stripe', {
    apiKey: providerConfig.apiKey,
    webhookSecret: providerConfig.webhookSecret,
  });

  let event;
  try {
    event = await stripeProvider.constructEvent(payload, signature);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  // Check for duplicate using WebhookGuard
  const webhookGuardId = env.DO_WEBHOOK_GUARD.idFromName(`${tenantId}:stripe`);
  const webhookGuard = env.DO_WEBHOOK_GUARD.get(webhookGuardId);

  const dedupeResponse = await webhookGuard.fetch('http://internal/dedupe', {
    method: 'POST',
    body: JSON.stringify({ eventId: event.id, eventType: event.type }),
  });

  const dedupeResult = (await dedupeResponse.json()) as { shouldProcess?: boolean; duplicate?: boolean };

  if (dedupeResult.duplicate || dedupeResult.shouldProcess === false) {
    return c.json({ received: true, duplicate: true });
  }

  // Log the webhook event
  const webhookEventId = generateId('whe');
  await db.insert(webhookEvents).values({
    id: webhookEventId,
    tenantId,
    provider: 'stripe',
    eventId: event.id,
    eventType: event.type,
    status: 'processing',
    payload: event.data,
    receivedAt: now,
    createdAt: now,
  });

  try {
    // Process the event
    await processStripeEvent(db, tenantId, event, provider.id, now);

    // Mark as processed
    await db
      .update(webhookEvents)
      .set({ status: 'processed', processedAt: new Date().toISOString() })
      .where(eq(webhookEvents.id, webhookEventId));

    await webhookGuard.fetch('http://internal/complete', {
      method: 'POST',
      body: JSON.stringify({ eventId: event.id, success: true }),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Stripe webhook processing error:', errorMessage);

    await db
      .update(webhookEvents)
      .set({
        status: 'failed',
        errorMessage,
        processedAt: new Date().toISOString(),
      })
      .where(eq(webhookEvents.id, webhookEventId));

    await webhookGuard.fetch('http://internal/complete', {
      method: 'POST',
      body: JSON.stringify({ eventId: event.id, success: false, errorMessage }),
    });
  }

  return c.json({ received: true });
});

// Adyen webhook handler
webhooksRouter.post('/adyen/:tenantId', async (c) => {
  const tenantId = c.req.param('tenantId');
  const db = c.get('db');
  const env = c.env;
  const now = new Date().toISOString();

  // Get raw body
  const payload = await c.req.text();
  const hmacSignature = c.req.header('x-adyen-hmac-signature');

  // Get tenant's Adyen configuration
  const [provider] = await db
    .select()
    .from(paymentProviders)
    .where(
      and(eq(paymentProviders.tenantId, tenantId), eq(paymentProviders.provider, 'adyen'))
    );

  if (!provider) {
    return c.json({ error: 'Adyen not configured for this tenant' }, 400);
  }

  const providerConfig = provider.config as {
    apiKey: string;
    webhookSecret: string;
    merchantAccount: string;
  };

  const adyenProvider = createPaymentProvider('adyen', {
    apiKey: providerConfig.apiKey,
    webhookSecret: providerConfig.webhookSecret,
    merchantAccount: providerConfig.merchantAccount,
  });

  let event;
  try {
    event = await adyenProvider.constructEvent(payload, hmacSignature || '');
  } catch (error) {
    console.error('Adyen webhook signature verification failed:', error);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  // Check for duplicate using WebhookGuard
  const webhookGuardId = env.DO_WEBHOOK_GUARD.idFromName(`${tenantId}:adyen`);
  const webhookGuard = env.DO_WEBHOOK_GUARD.get(webhookGuardId);

  const dedupeResponse = await webhookGuard.fetch('http://internal/dedupe', {
    method: 'POST',
    body: JSON.stringify({ eventId: event.id, eventType: event.type }),
  });

  const dedupeResult = (await dedupeResponse.json()) as { shouldProcess?: boolean; duplicate?: boolean };

  if (dedupeResult.duplicate || dedupeResult.shouldProcess === false) {
    // Adyen requires [accepted] response
    return c.text('[accepted]');
  }

  // Log the webhook event
  const webhookEventId = generateId('whe');
  await db.insert(webhookEvents).values({
    id: webhookEventId,
    tenantId,
    provider: 'adyen',
    eventId: event.id,
    eventType: event.type,
    status: 'processing',
    payload: event.data,
    receivedAt: now,
    createdAt: now,
  });

  try {
    // Process the event (Adyen events are mapped to Stripe-like types)
    await processStripeEvent(db, tenantId, event, provider.id, now);

    await db
      .update(webhookEvents)
      .set({ status: 'processed', processedAt: new Date().toISOString() })
      .where(eq(webhookEvents.id, webhookEventId));

    await webhookGuard.fetch('http://internal/complete', {
      method: 'POST',
      body: JSON.stringify({ eventId: event.id, success: true }),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Adyen webhook processing error:', errorMessage);

    await db
      .update(webhookEvents)
      .set({
        status: 'failed',
        errorMessage,
        processedAt: new Date().toISOString(),
      })
      .where(eq(webhookEvents.id, webhookEventId));

    await webhookGuard.fetch('http://internal/complete', {
      method: 'POST',
      body: JSON.stringify({ eventId: event.id, success: false, errorMessage }),
    });
  }

  // Adyen requires [accepted] response
  return c.text('[accepted]');
});

// Process payment events (works for both Stripe and Adyen after normalization)
async function processStripeEvent(
  db: any,
  tenantId: string,
  event: { id: string; type: string; data: any },
  providerId: string,
  now: string
): Promise<void> {
  const eventData = event.data;

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntentId = eventData.id || eventData.pspReference;
      const metadata = eventData.metadata || {};
      const invoiceId = metadata.invoiceId;

      if (!invoiceId) {
        console.log('Payment succeeded but no invoiceId in metadata');
        return;
      }

      // Get invoice
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

      if (!invoice) {
        console.error('Invoice not found:', invoiceId);
        return;
      }

      // Check if payment already recorded
      const existingPayment = await db
        .select()
        .from(payments)
        .where(eq(payments.providerPaymentId, paymentIntentId));

      if (existingPayment.length > 0) {
        console.log('Payment already recorded:', paymentIntentId);
        return;
      }

      // Record payment
      const paymentId = generateId('pay');
      const amount = eventData.amount || eventData.amount?.value || 0;

      await db.insert(payments).values({
        id: paymentId,
        tenantId,
        invoiceId,
        providerId,
        providerPaymentId: paymentIntentId,
        paymentMethod: 'card',
        paymentMethodDetails: eventData.payment_method_types || eventData.paymentMethod,
        status: 'succeeded',
        amount,
        currency: (eventData.currency || eventData.amount?.currency || 'gbp').toUpperCase(),
        platformFee: eventData.application_fee_amount || 0,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Update invoice
      const newPaidAmount = invoice.paidAmount + amount;
      const newStatus = newPaidAmount >= invoice.totalAmount ? 'paid' : 'partial';

      await db
        .update(invoices)
        .set({
          paidAmount: newPaidAmount,
          status: newStatus,
          paidDate: newStatus === 'paid' ? now : null,
          updatedAt: now,
        })
        .where(eq(invoices.id, invoiceId));

      // Update booking if applicable
      if (invoice.bookingId) {
        const bookingPaymentStatus = newStatus === 'paid' ? 'paid' : 'partial';
        await db
          .update(bookings)
          .set({
            paymentStatus: bookingPaymentStatus,
            status: bookingPaymentStatus === 'paid' ? 'confirmed' : undefined,
            updatedAt: now,
          })
          .where(eq(bookings.id, invoice.bookingId));
      }

      // TODO: Queue confirmation notification
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntentId = eventData.id || eventData.pspReference;
      const metadata = eventData.metadata || {};
      const invoiceId = metadata.invoiceId;

      if (!invoiceId) return;

      // Record failed payment attempt
      const paymentId = generateId('pay');

      await db.insert(payments).values({
        id: paymentId,
        tenantId,
        invoiceId,
        providerId,
        providerPaymentId: paymentIntentId,
        paymentMethod: 'card',
        status: 'failed',
        amount: eventData.amount || eventData.amount?.value || 0,
        currency: (eventData.currency || eventData.amount?.currency || 'gbp').toUpperCase(),
        failureCode: eventData.last_payment_error?.code || eventData.refusalReason,
        failureMessage:
          eventData.last_payment_error?.message || eventData.refusalReasonRaw || 'Payment failed',
        createdAt: now,
        updatedAt: now,
      });

      // TODO: Queue failure notification
      break;
    }

    case 'refund.created':
    case 'refund.updated': {
      // Handle refund events if needed
      // Most refund updates are already handled during the refund creation
      break;
    }

    case 'payment_intent.canceled': {
      // Payment was cancelled before completion
      const paymentIntentId = eventData.id || eventData.pspReference;

      await db
        .update(payments)
        .set({ status: 'cancelled', updatedAt: now })
        .where(eq(payments.providerPaymentId, paymentIntentId));
      break;
    }

    default:
      console.log('Unhandled event type:', event.type);
  }
}
