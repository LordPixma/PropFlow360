import { Text, Section, Row, Column, Button } from '@react-email/components';
import * as React from 'react';
import { Layout } from './components/Layout';

interface PaymentReceiptProps {
  guestName: string;
  invoiceNumber: string;
  paymentDate: string;
  amount: string;
  paymentMethod: string;
  description: string;
  invoiceUrl: string;
}

export function PaymentReceipt({
  guestName,
  invoiceNumber,
  paymentDate,
  amount,
  paymentMethod,
  description,
  invoiceUrl,
}: PaymentReceiptProps) {
  return (
    <Layout previewText={`Payment Receipt - ${invoiceNumber}`}>
      <Text style={title}>Payment Received</Text>

      <Text style={paragraph}>Hi {guestName},</Text>

      <Text style={paragraph}>
        Thank you for your payment. This email confirms that we've received your payment.
      </Text>

      <Section style={receiptBox}>
        <Text style={amountText}>{amount}</Text>
        <Text style={paidText}>PAID</Text>
      </Section>

      <Section style={detailsBox}>
        <Row style={detailRow}>
          <Column style={detailLabel}>Invoice:</Column>
          <Column style={detailValue}>{invoiceNumber}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Date:</Column>
          <Column style={detailValue}>{paymentDate}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Payment Method:</Column>
          <Column style={detailValue}>{paymentMethod}</Column>
        </Row>

        <Row style={detailRow}>
          <Column style={detailLabel}>Description:</Column>
          <Column style={detailValue}>{description}</Column>
        </Row>
      </Section>

      <Section style={buttonContainer}>
        <Button href={invoiceUrl} style={button}>
          View Invoice
        </Button>
      </Section>

      <Text style={paragraph}>
        Keep this email as your receipt. If you have any questions about this payment,
        please contact us.
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

const receiptBox = {
  backgroundColor: '#f0fdf4',
  border: '2px solid #10b981',
  borderRadius: '12px',
  padding: '32px',
  margin: '24px 0',
  textAlign: 'center' as const,
};

const amountText = {
  fontSize: '36px',
  fontWeight: 'bold',
  color: '#1a1a1a',
  margin: '0 0 8px',
};

const paidText = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#10b981',
  letterSpacing: '1px',
  margin: '0',
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
  width: '140px',
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
  backgroundColor: '#0070f3',
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

export default PaymentReceipt;
