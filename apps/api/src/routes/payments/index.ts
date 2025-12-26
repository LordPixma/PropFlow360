import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../../lib/context';
import { requireAuth } from '../../middleware/auth';
import { generateId } from '../../lib/id';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  createPaymentIntentSchema,
  recordPaymentSchema,
  createRefundSchema,
  listInvoicesSchema,
  listPaymentsSchema,
} from '@propflow360/validators';
import {
  invoices,
  payments,
  refunds,
  paymentProviders,
  guests,
  bookings,
} from '@propflow360/db';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { createPaymentProvider } from '@propflow360/payments';

export const paymentsRouter = new Hono<AppEnv>();

// Apply auth middleware to all routes
paymentsRouter.use('*', requireAuth);

// ============================================================
// Invoice Routes
// ============================================================

// List invoices
paymentsRouter.get('/invoices', zValidator('query', listInvoicesSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const query = c.req.valid('query');

  const conditions = [eq(invoices.tenantId, tenantId)];

  if (query.bookingId) conditions.push(eq(invoices.bookingId, query.bookingId));
  if (query.leaseId) conditions.push(eq(invoices.leaseId, query.leaseId));
  if (query.guestId) conditions.push(eq(invoices.guestId, query.guestId));
  if (query.type) conditions.push(eq(invoices.type, query.type));
  if (query.status) conditions.push(eq(invoices.status, query.status));
  if (query.startDate) conditions.push(gte(invoices.issueDate, query.startDate));
  if (query.endDate) conditions.push(lte(invoices.issueDate, query.endDate));

  if (query.overdue) {
    const today = new Date().toISOString().split('T')[0];
    conditions.push(lte(invoices.dueDate, today));
    conditions.push(sql`${invoices.status} NOT IN ('paid', 'cancelled', 'refunded')`);
  }

  const offset = (query.page - 1) * query.pageSize;

  const [invoiceResults, countResult] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        bookingId: invoices.bookingId,
        leaseId: invoices.leaseId,
        guestId: invoices.guestId,
        type: invoices.type,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount,
        currency: invoices.currency,
        guestName: sql<string>`${guests.firstName} || ' ' || ${guests.lastName}`,
        guestEmail: guests.email,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .leftJoin(guests, eq(invoices.guestId, guests.id))
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt))
      .limit(query.pageSize)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(and(...conditions)),
  ]);

  return c.json({
    invoices: invoiceResults,
    total: countResult[0]?.count || 0,
    page: query.page,
    pageSize: query.pageSize,
  });
});

// Get invoice by ID
paymentsRouter.get('/invoices/:id', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const invoiceId = c.req.param('id');

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

  if (!invoice) {
    return c.json({ error: 'Invoice not found' }, 404);
  }

  // Get guest info
  const [guest] = await db.select().from(guests).where(eq(guests.id, invoice.guestId));

  // Get payments for this invoice
  const invoicePayments = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.createdAt));

  return c.json({
    invoice: {
      ...invoice,
      guestName: guest ? `${guest.firstName} ${guest.lastName}` : null,
      guestEmail: guest?.email,
      payments: invoicePayments,
    },
  });
});

// Create invoice
paymentsRouter.post('/invoices', zValidator('json', createInvoiceSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  // Verify guest exists
  const [guest] = await db
    .select()
    .from(guests)
    .where(and(eq(guests.id, data.guestId), eq(guests.tenantId, tenantId)));

  if (!guest) {
    return c.json({ error: 'Guest not found' }, 400);
  }

  // Generate invoice number
  const [lastInvoice] = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(eq(invoices.tenantId, tenantId))
    .orderBy(desc(invoices.createdAt))
    .limit(1);

  const lastNumber = lastInvoice?.invoiceNumber
    ? parseInt(lastInvoice.invoiceNumber.replace('INV-', ''), 10)
    : 0;
  const invoiceNumber = `INV-${String(lastNumber + 1).padStart(6, '0')}`;

  // Calculate totals
  let subtotal = 0;
  for (const item of data.lineItems) {
    subtotal += item.amount;
  }

  const discountAmount = data.discountAmount || 0;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = data.taxRate ? Math.round((taxableAmount * data.taxRate) / 10000) : 0;
  const totalAmount = taxableAmount + taxAmount;

  const invoiceId = generateId('inv');

  await db.insert(invoices).values({
    id: invoiceId,
    tenantId,
    invoiceNumber,
    bookingId: data.bookingId || null,
    leaseId: data.leaseId || null,
    guestId: data.guestId,
    type: data.type,
    status: 'draft',
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount,
    paidAmount: 0,
    currency: data.currency,
    lineItems: data.lineItems,
    taxRate: data.taxRate || null,
    taxNumber: data.taxNumber || null,
    notes: data.notes || null,
    internalNotes: data.internalNotes || null,
    createdAt: now,
    updatedAt: now,
  });

  const [newInvoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));

  return c.json({ invoice: newInvoice }, 201);
});

// Update invoice
paymentsRouter.patch('/invoices/:id', zValidator('json', updateInvoiceSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const invoiceId = c.req.param('id');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

  if (!invoice) {
    return c.json({ error: 'Invoice not found' }, 404);
  }

  if (invoice.status !== 'draft') {
    return c.json({ error: 'Only draft invoices can be updated' }, 400);
  }

  const updates: Partial<typeof invoice> = { updatedAt: now };

  if (data.issueDate) updates.issueDate = data.issueDate;
  if (data.dueDate) updates.dueDate = data.dueDate;
  if (data.taxRate !== undefined) updates.taxRate = data.taxRate;
  if (data.taxNumber !== undefined) updates.taxNumber = data.taxNumber;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.internalNotes !== undefined) updates.internalNotes = data.internalNotes;

  if (data.lineItems) {
    let subtotal = 0;
    for (const item of data.lineItems) {
      subtotal += item.amount;
    }

    const discountAmount = data.discountAmount ?? invoice.discountAmount;
    const taxRate = data.taxRate ?? invoice.taxRate ?? 0;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = Math.round((taxableAmount * taxRate) / 10000);

    updates.lineItems = data.lineItems;
    updates.subtotal = subtotal;
    updates.taxAmount = taxAmount;
    updates.totalAmount = taxableAmount + taxAmount;
  }

  if (data.discountAmount !== undefined) {
    updates.discountAmount = data.discountAmount;
    // Recalculate total
    const subtotal = updates.subtotal ?? invoice.subtotal;
    const taxRate = updates.taxRate ?? invoice.taxRate ?? 0;
    const taxableAmount = subtotal - data.discountAmount;
    const taxAmount = Math.round((taxableAmount * taxRate) / 10000);
    updates.taxAmount = taxAmount;
    updates.totalAmount = taxableAmount + taxAmount;
  }

  await db.update(invoices).set(updates).where(eq(invoices.id, invoiceId));

  const [updated] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));

  return c.json({ invoice: updated });
});

// Send invoice
paymentsRouter.post('/invoices/:id/send', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const invoiceId = c.req.param('id');
  const now = new Date().toISOString();

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

  if (!invoice) {
    return c.json({ error: 'Invoice not found' }, 404);
  }

  if (invoice.status !== 'draft') {
    return c.json({ error: 'Only draft invoices can be sent' }, 400);
  }

  await db
    .update(invoices)
    .set({ status: 'sent', updatedAt: now })
    .where(eq(invoices.id, invoiceId));

  // TODO: Queue notification email

  return c.json({ success: true, message: 'Invoice sent' });
});

// Cancel invoice
paymentsRouter.post('/invoices/:id/cancel', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const invoiceId = c.req.param('id');
  const now = new Date().toISOString();

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

  if (!invoice) {
    return c.json({ error: 'Invoice not found' }, 404);
  }

  if (invoice.paidAmount > 0) {
    return c.json({ error: 'Cannot cancel an invoice with payments. Issue a refund instead.' }, 400);
  }

  await db
    .update(invoices)
    .set({ status: 'cancelled', updatedAt: now })
    .where(eq(invoices.id, invoiceId));

  return c.json({ success: true });
});

// ============================================================
// Payment Intent Routes (for online payments)
// ============================================================

// Create payment intent
paymentsRouter.post(
  '/payment-intents',
  zValidator('json', createPaymentIntentSchema),
  async (c) => {
    const tenantId = c.get('tenantId');
    const db = c.get('db');
    const data = c.req.valid('json');

    // Get invoice
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, data.invoiceId), eq(invoices.tenantId, tenantId)));

    if (!invoice) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    if (invoice.status === 'paid') {
      return c.json({ error: 'Invoice is already paid' }, 400);
    }

    if (invoice.status === 'cancelled') {
      return c.json({ error: 'Invoice is cancelled' }, 400);
    }

    // Get default payment provider
    const [provider] = await db
      .select()
      .from(paymentProviders)
      .where(and(eq(paymentProviders.tenantId, tenantId), eq(paymentProviders.isDefault, true)));

    if (!provider) {
      return c.json({ error: 'No payment provider configured' }, 400);
    }

    // Calculate amount
    const remainingAmount = invoice.totalAmount - invoice.paidAmount;
    const amount = data.amount ? Math.min(data.amount, remainingAmount) : remainingAmount;

    if (amount <= 0) {
      return c.json({ error: 'Invalid payment amount' }, 400);
    }

    // Create payment provider instance
    const providerConfig = provider.config as {
      apiKey: string;
      webhookSecret: string;
      merchantAccount?: string;
    };

    const paymentProviderInstance = createPaymentProvider(
      provider.provider as 'stripe' | 'adyen',
      {
        apiKey: providerConfig.apiKey,
        webhookSecret: providerConfig.webhookSecret,
        merchantAccount: providerConfig.merchantAccount,
      }
    );

    // Create payment intent
    const paymentIntent = await paymentProviderInstance.createPaymentIntent({
      amount,
      currency: invoice.currency,
      tenantId,
      invoiceId: invoice.id,
      bookingId: invoice.bookingId || undefined,
      returnUrl: data.returnUrl,
    });

    return c.json({
      clientSecret: paymentIntent.clientSecret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency: invoice.currency,
    });
  }
);

// ============================================================
// Payment Routes
// ============================================================

// List payments
paymentsRouter.get('/payments', zValidator('query', listPaymentsSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const query = c.req.valid('query');

  const conditions = [eq(payments.tenantId, tenantId)];

  if (query.invoiceId) conditions.push(eq(payments.invoiceId, query.invoiceId));
  if (query.status) conditions.push(eq(payments.status, query.status));
  if (query.startDate) conditions.push(gte(payments.createdAt, query.startDate));
  if (query.endDate) conditions.push(lte(payments.createdAt, query.endDate));

  const offset = (query.page - 1) * query.pageSize;

  const [paymentResults, countResult] = await Promise.all([
    db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        amount: payments.amount,
        currency: payments.currency,
        paymentMethod: payments.paymentMethod,
        status: payments.status,
        processedAt: payments.processedAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt))
      .limit(query.pageSize)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(and(...conditions)),
  ]);

  return c.json({
    payments: paymentResults,
    total: countResult[0]?.count || 0,
    page: query.page,
    pageSize: query.pageSize,
  });
});

// Record manual payment
paymentsRouter.post('/payments', zValidator('json', recordPaymentSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  // Get invoice
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, data.invoiceId), eq(invoices.tenantId, tenantId)));

  if (!invoice) {
    return c.json({ error: 'Invoice not found' }, 404);
  }

  if (invoice.status === 'paid') {
    return c.json({ error: 'Invoice is already paid' }, 400);
  }

  if (invoice.status === 'cancelled') {
    return c.json({ error: 'Invoice is cancelled' }, 400);
  }

  // Validate amount
  const remainingAmount = invoice.totalAmount - invoice.paidAmount;
  if (data.amount > remainingAmount) {
    return c.json({ error: `Amount exceeds remaining balance (${remainingAmount})` }, 400);
  }

  const paymentId = generateId('pay');

  await db.insert(payments).values({
    id: paymentId,
    tenantId,
    invoiceId: data.invoiceId,
    paymentMethod: data.paymentMethod,
    status: 'succeeded',
    amount: data.amount,
    currency: invoice.currency,
    processedAt: data.processedAt || now,
    createdAt: now,
    updatedAt: now,
  });

  // Update invoice
  const newPaidAmount = invoice.paidAmount + data.amount;
  const newStatus = newPaidAmount >= invoice.totalAmount ? 'paid' : 'partial';

  await db
    .update(invoices)
    .set({
      paidAmount: newPaidAmount,
      status: newStatus,
      paidDate: newStatus === 'paid' ? now : null,
      updatedAt: now,
    })
    .where(eq(invoices.id, data.invoiceId));

  // If booking, update booking payment status
  if (invoice.bookingId) {
    const bookingPaymentStatus = newStatus === 'paid' ? 'paid' : 'partial';
    await db
      .update(bookings)
      .set({ paymentStatus: bookingPaymentStatus, updatedAt: now })
      .where(eq(bookings.id, invoice.bookingId));
  }

  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));

  return c.json({ payment }, 201);
});

// ============================================================
// Refund Routes
// ============================================================

// Create refund
paymentsRouter.post('/refunds', zValidator('json', createRefundSchema), async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const data = c.req.valid('json');
  const now = new Date().toISOString();

  // Get payment
  const [payment] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, data.paymentId), eq(payments.tenantId, tenantId)));

  if (!payment) {
    return c.json({ error: 'Payment not found' }, 404);
  }

  if (payment.status !== 'succeeded') {
    return c.json({ error: 'Only successful payments can be refunded' }, 400);
  }

  // Calculate refund amount
  const amount = data.amount || payment.amount;

  // Check for existing refunds
  const existingRefunds = await db
    .select({ total: sql<number>`sum(amount)` })
    .from(refunds)
    .where(and(eq(refunds.paymentId, data.paymentId), eq(refunds.status, 'succeeded')));

  const alreadyRefunded = existingRefunds[0]?.total || 0;
  const maxRefundable = payment.amount - alreadyRefunded;

  if (amount > maxRefundable) {
    return c.json({ error: `Cannot refund more than ${maxRefundable}` }, 400);
  }

  const refundId = generateId('ref');

  // For online payments, process through provider
  if (payment.providerPaymentId) {
    // Get payment provider
    const [provider] = await db
      .select()
      .from(paymentProviders)
      .where(eq(paymentProviders.id, payment.providerId!));

    if (provider) {
      const providerConfig = provider.config as {
        apiKey: string;
        webhookSecret: string;
        merchantAccount?: string;
      };

      const paymentProviderInstance = createPaymentProvider(
        provider.provider as 'stripe' | 'adyen',
        {
          apiKey: providerConfig.apiKey,
          webhookSecret: providerConfig.webhookSecret,
          merchantAccount: providerConfig.merchantAccount,
        }
      );

      try {
        const providerRefund = await paymentProviderInstance.createRefund({
          paymentId: payment.providerPaymentId,
          amount,
          reason: data.reason,
        });

        await db.insert(refunds).values({
          id: refundId,
          tenantId,
          paymentId: data.paymentId,
          providerRefundId: providerRefund.providerId,
          status: providerRefund.status,
          amount,
          currency: payment.currency,
          reason: data.reason,
          description: data.description || null,
          processedAt: providerRefund.status === 'succeeded' ? now : null,
          createdAt: now,
          updatedAt: now,
        });
      } catch (error) {
        return c.json(
          { error: `Refund failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
          400
        );
      }
    }
  } else {
    // Manual refund
    await db.insert(refunds).values({
      id: refundId,
      tenantId,
      paymentId: data.paymentId,
      status: 'succeeded',
      amount,
      currency: payment.currency,
      reason: data.reason,
      description: data.description || null,
      processedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Update invoice paid amount
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, payment.invoiceId));

  if (invoice) {
    const newPaidAmount = Math.max(0, invoice.paidAmount - amount);
    const newStatus = newPaidAmount === 0 ? 'refunded' : 'partial';

    await db
      .update(invoices)
      .set({
        paidAmount: newPaidAmount,
        status: newStatus,
        updatedAt: now,
      })
      .where(eq(invoices.id, payment.invoiceId));
  }

  const [refund] = await db.select().from(refunds).where(eq(refunds.id, refundId));

  return c.json({ refund }, 201);
});

// List refunds for a payment
paymentsRouter.get('/payments/:id/refunds', async (c) => {
  const tenantId = c.get('tenantId');
  const db = c.get('db');
  const paymentId = c.req.param('id');

  const paymentRefunds = await db
    .select()
    .from(refunds)
    .where(and(eq(refunds.paymentId, paymentId), eq(refunds.tenantId, tenantId)))
    .orderBy(desc(refunds.createdAt));

  return c.json({ refunds: paymentRefunds });
});
