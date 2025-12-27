/**
 * Notification Worker
 *
 * Processes notification queue from D1 and sends via email (Resend) or SMS (Twilio)
 * Runs on a cron schedule to process pending notifications
 */

import { drizzle } from 'drizzle-orm/d1';
import { notifications } from '@propflow360/db';
import { eq, and, lte, or, isNull } from 'drizzle-orm';

interface Env {
  DB_CORE: D1Database;
  RESEND_API_KEY: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
}

interface NotificationRecord {
  id: string;
  tenantId: string;
  type: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  recipientName: string | null;
  subject: string | null;
  body: string;
  status: string;
  retryCount: number;
  maxRetries: number;
  providerMessageId: string | null;
  providerResponse: any;
}

export default {
  // Cron trigger - runs every minute
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Notification worker triggered:', new Date().toISOString());

    const db = drizzle(env.DB_CORE);
    const now = new Date().toISOString();

    try {
      // Fetch pending notifications (ready to send)
      const pendingNotifications = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.status, 'pending'),
            or(
              isNull(notifications.scheduledFor),
              lte(notifications.scheduledFor, now)
            )
          )
        )
        .limit(50); // Process 50 at a time

      console.log(`Found ${pendingNotifications.length} pending notifications`);

      for (const notification of pendingNotifications) {
        ctx.waitUntil(processNotification(db, env, notification as NotificationRecord));
      }

      // Retry failed notifications
      const failedNotifications = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.status, 'failed'),
            lte(notifications.retryCount, notifications.maxRetries)
          )
        )
        .limit(20);

      console.log(`Found ${failedNotifications.length} failed notifications to retry`);

      for (const notification of failedNotifications) {
        ctx.waitUntil(processNotification(db, env, notification as NotificationRecord));
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    }
  },

  // HTTP endpoint for manual triggering
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    if (url.pathname === '/process' && request.method === 'POST') {
      // Manual trigger
      const db = drizzle(env.DB_CORE);
      const now = new Date().toISOString();

      const pendingNotifications = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.status, 'pending'),
            or(
              isNull(notifications.scheduledFor),
              lte(notifications.scheduledFor, now)
            )
          )
        )
        .limit(10);

      const results = [];
      for (const notification of pendingNotifications) {
        const result = await processNotification(db, env, notification as NotificationRecord);
        results.push(result);
      }

      return Response.json({ processed: results.length, results });
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function processNotification(
  db: any,
  env: Env,
  notification: NotificationRecord
): Promise<boolean> {
  const now = new Date().toISOString();

  try {
    // Mark as sending
    await db
      .update(notifications)
      .set({ status: 'sending', updatedAt: now })
      .where(eq(notifications.id, notification.id));

    let success = false;
    let providerMessageId: string | null = null;
    let providerResponse: any = null;

    if (notification.type === 'email') {
      const result = await sendEmail(env, notification);
      success = result.success;
      providerMessageId = result.messageId ?? null;
      providerResponse = result.response;
    } else if (notification.type === 'sms') {
      const result = await sendSMS(env, notification);
      success = result.success;
      providerMessageId = result.messageId ?? null;
      providerResponse = result.response;
    }

    if (success) {
      await db
        .update(notifications)
        .set({
          status: 'sent',
          sentAt: now,
          providerMessageId,
          providerResponse: JSON.stringify(providerResponse),
          updatedAt: now,
        })
        .where(eq(notifications.id, notification.id));

      console.log(`✓ Notification ${notification.id} sent successfully`);
      return true;
    } else {
      throw new Error('Send failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const newRetryCount = notification.retryCount + 1;
    const shouldRetry = newRetryCount <= notification.maxRetries;

    await db
      .update(notifications)
      .set({
        status: shouldRetry ? 'failed' : 'failed',
        failureReason: errorMessage,
        retryCount: newRetryCount,
        updatedAt: now,
      })
      .where(eq(notifications.id, notification.id));

    console.error(`✗ Notification ${notification.id} failed:`, errorMessage);
    return false;
  }
}

async function sendEmail(
  env: Env,
  notification: NotificationRecord
): Promise<{ success: boolean; messageId?: string; response?: any }> {
  if (!notification.recipientEmail) {
    throw new Error('No recipient email');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'PropFlow360 <notifications@propflow360.com>',
      to: notification.recipientEmail,
      subject: notification.subject || 'Notification',
      html: notification.body,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  const data = await response.json() as { id: string };

  return {
    success: true,
    messageId: data.id,
    response: data,
  };
}

async function sendSMS(
  env: Env,
  notification: NotificationRecord
): Promise<{ success: boolean; messageId?: string; response?: any }> {
  if (!notification.recipientPhone) {
    throw new Error('No recipient phone');
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    throw new Error('Twilio credentials not configured');
  }

  const credentials = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

  const formData = new URLSearchParams();
  formData.append('To', notification.recipientPhone);
  formData.append('From', env.TWILIO_FROM_NUMBER);
  formData.append('Body', notification.body);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: formData.toString(),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio API error: ${error}`);
  }

  const data = await response.json() as { sid: string };

  return {
    success: true,
    messageId: data.sid,
    response: data,
  };
}
