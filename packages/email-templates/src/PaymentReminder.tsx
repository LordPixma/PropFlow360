import { Text, Section, Row, Column, Button } from '@react-email/components';
import * as React from 'react';
import { Layout } from './components/Layout';

interface PaymentReminderProps {
  guestName: string;
  invoiceNumber: string;
  dueDate: string;
  amountDue: string;
  daysOverdue?: number;
  description: string;
  paymentUrl: string;
}

export function PaymentReminder({
  guestName,
  invoiceNumber,
  dueDate,
  amountDue,
  daysOverdue,
  description,
  paymentUrl,
}: PaymentReminderProps) {
  const isOverdue = daysOverdue && daysOverdue > 0;

  return (
    <Layout previewText={`Payment ${isOverdue ? 'Overdue' : 'Reminder'} - ${invoiceNumber}`}>
      <Text style={title}>
        {isOverdue ? 'Payment Overdue' : 'Payment Reminder'}
      </Text>

      <Text style={paragraph}>Hi {guestName},</Text>

      <Text style={paragraph}>
        {isOverdue
          ? `This is a reminder that your payment is ${daysOverdue} ${daysOverdue === 1 ? 'day' : 'days'} overdue. Please make payment as soon as possible to avoid late fees.`
          : 'This is a friendly reminder that you have an upcoming payment due.'}
      </Text>

      <Section style={isOverdue ? overdueBox : reminderBox}>
        <Text style={amountLabel}>Amount Due</Text>
        <Text style={amountText}>{amountDue}</Text>
        <Text style={dueDateText}>
          Due: {dueDate}
          {isOverdue && <span style={overdueLabel}> (OVERDUE)</span>}
        </Text>
      </Section>

      <Section style={detailsBox}>
        <Row style={detailRow}>
          <Column style={detailLabel}>Invoice:</Column>
          <Column style={detailValue}>{invoiceNumber}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Description:</Column>
          <Column style={detailValue}>{description}</Column>
        </Row>
      </Section>

      <Section style={buttonContainer}>
        <Button href={paymentUrl} style={button}>
          Make Payment Now
        </Button>
      </Section>

      <Text style={paragraph}>
        If you've already made this payment, please disregard this email.
        Payments can take 1-2 business days to process.
      </Text>

      <Text style={paragraph}>
        If you have any questions or need to discuss payment arrangements,
        please contact us immediately.
      </Text>

      <Text style={signature}>
        Best regards,<br />
        The PropFlow360 Team
      </Text>
    </Layout>
  );
}

const title = {
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '32px 0 24px',
  color: '#1a1a1a',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#525252',
  margin: '16px 0',
};

const reminderBox = {
  backgroundColor: '#fef3c7',
  border: '2px solid #f59e0b',
  borderRadius: '12px',
  padding: '32px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const overdueBox = {
  backgroundColor: '#fee2e2',
  border: '2px solid #ef4444',
  borderRadius: '12px',
  padding: '32px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const amountLabel = {
  fontSize: '14px',
  fontWeight: '500',
  color: '#737373',
  margin: '0 0 8px',
};

const amountText = {
  fontSize: '36px',
  fontWeight: 'bold',
  color: '#1a1a1a',
  margin: '0 0 8px',
};

const dueDateText = {
  fontSize: '14px',
  color: '#525252',
  margin: '0',
};

const overdueLabel = {
  color: '#ef4444',
  fontWeight: 'bold',
};

const detailsBox = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const detailRow = {
  marginBottom: '12px',
};

const detailLabel = {
  fontSize: '14px',
  color: '#737373',
  width: '120px',
};

const detailValue = {
  fontSize: '14px',
  color: '#1a1a1a',
  fontWeight: '500',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#ef4444',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
};

const signature = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#525252',
  margin: '32px 0 0',
};

export default PaymentReminder;
