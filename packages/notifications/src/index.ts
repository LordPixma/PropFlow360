// Notification helper utilities

export interface QueueNotificationParams {
  tenantId: string;
  type: 'email' | 'sms';
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName?: string;
  event: string;
  variables: Record<string, any>;
  bookingId?: string;
  leaseId?: string;
  invoiceId?: string;
  maintenanceTicketId?: string;
  cleaningScheduleId?: string;
  scheduledFor?: string; // ISO timestamp
}

export interface NotificationTemplate {
  id: string;
  event: string;
  type: string;
  emailSubject?: string | null;
  emailBody?: string | null;
  emailTemplate?: string | null;
  smsBody?: string | null;
  isActive: boolean;
}

/**
 * Render template with variables
 * Simple variable replacement: {{variableName}}
 */
export function renderTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key]?.toString() || match;
  });
}

/**
 * Queue a notification for sending
 */
export async function queueNotification(
  db: any,
  params: QueueNotificationParams
): Promise<string> {
  const {
    tenantId,
    type,
    recipientEmail,
    recipientPhone,
    recipientName,
    event,
    variables,
    bookingId,
    leaseId,
    invoiceId,
    maintenanceTicketId,
    cleaningScheduleId,
    scheduledFor,
  } = params;

  // Find active template for event
  const templates = await db
    .select()
    .from('notification_templates')
    .where({
      tenant_id: tenantId,
      event,
      is_active: true,
    })
    .limit(1);

  const template = templates[0] as NotificationTemplate | undefined;

  let subject: string | undefined;
  let body: string;

  if (template) {
    if (type === 'email') {
      subject = template.emailSubject
        ? renderTemplate(template.emailSubject, variables)
        : undefined;
      body = template.emailBody
        ? renderTemplate(template.emailBody, variables)
        : `Event: ${event}`;
    } else {
      body = template.smsBody
        ? renderTemplate(template.smsBody, variables)
        : `Event: ${event}`;
    }
  } else {
    // Fallback if no template
    subject = type === 'email' ? `Notification: ${event}` : undefined;
    body = `Event: ${event}`;
  }

  const notificationId = `ntf_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date().toISOString();

  await db.insert('notifications').values({
    id: notificationId,
    tenant_id: tenantId,
    template_id: template?.id || null,
    type,
    recipient_email: recipientEmail || null,
    recipient_phone: recipientPhone || null,
    recipient_name: recipientName || null,
    subject,
    body,
    variables: JSON.stringify(variables),
    booking_id: bookingId || null,
    lease_id: leaseId || null,
    invoice_id: invoiceId || null,
    maintenance_ticket_id: maintenanceTicketId || null,
    cleaning_schedule_id: cleaningScheduleId || null,
    status: 'pending',
    scheduled_for: scheduledFor || null,
    retry_count: 0,
    max_retries: 3,
    created_at: now,
    updated_at: now,
  });

  return notificationId;
}

/**
 * Common notification events
 */
export const NotificationEvents = {
  // Booking events
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  BOOKING_MODIFIED: 'booking_modified',
  BOOKING_CHECK_IN_REMINDER: 'booking_check_in_reminder',
  BOOKING_CHECK_OUT_REMINDER: 'booking_check_out_reminder',

  // Payment events
  PAYMENT_RECEIVED: 'payment_received',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_REMINDER: 'payment_reminder',
  INVOICE_SENT: 'invoice_sent',

  // Lease events
  LEASE_CREATED: 'lease_created',
  LEASE_ACTIVATED: 'lease_activated',
  LEASE_TERMINATING_SOON: 'lease_terminating_soon',
  RENT_DUE_REMINDER: 'rent_due_reminder',

  // Operations events
  MAINTENANCE_TICKET_CREATED: 'maintenance_ticket_created',
  MAINTENANCE_TICKET_ASSIGNED: 'maintenance_ticket_assigned',
  MAINTENANCE_TICKET_COMPLETED: 'maintenance_ticket_completed',
  CLEANING_ASSIGNED: 'cleaning_assigned',
  CLEANING_COMPLETED: 'cleaning_completed',
} as const;
