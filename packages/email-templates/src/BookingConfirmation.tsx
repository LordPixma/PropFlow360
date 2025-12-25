import { Text, Section, Row, Column, Button } from '@react-email/components';
import * as React from 'react';
import { Layout } from './components/Layout';

interface BookingConfirmationProps {
  guestName: string;
  propertyName: string;
  unitName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalAmount: string;
  bookingNumber: string;
  bookingUrl: string;
}

export function BookingConfirmation({
  guestName,
  propertyName,
  unitName,
  checkIn,
  checkOut,
  guests,
  totalAmount,
  bookingNumber,
  bookingUrl,
}: BookingConfirmationProps) {
  return (
    <Layout previewText={`Booking Confirmed - ${propertyName}`}>
      <Text style={title}>Booking Confirmed!</Text>

      <Text style={paragraph}>Hi {guestName},</Text>

      <Text style={paragraph}>
        Great news! Your booking has been confirmed. We're looking forward to hosting you.
      </Text>

      <Section style={infoBox}>
        <Text style={infoTitle}>Booking Details</Text>

        <Row style={infoRow}>
          <Column style={infoLabel}>Property:</Column>
          <Column style={infoValue}>{propertyName} - {unitName}</Column>
        </Row>

        <Row style={infoRow}>
          <Column style={infoLabel}>Check-in:</Column>
          <Column style={infoValue}>{checkIn}</Column>
        </Row>

        <Row style={infoRow}>
          <Column style={infoLabel}>Check-out:</Column>
          <Column style={infoValue}>{checkOut}</Column>
        </Row>

        <Row style={infoRow}>
          <Column style={infoLabel}>Guests:</Column>
          <Column style={infoValue}>{guests}</Column>
        </Row>

        <Row style={infoRow}>
          <Column style={infoLabel}>Total:</Column>
          <Column style={infoValue}>{totalAmount}</Column>
        </Row>

        <Row style={infoRow}>
          <Column style={infoLabel}>Booking #:</Column>
          <Column style={infoValue}>{bookingNumber}</Column>
        </Row>
      </Section>

      <Section style={buttonContainer}>
        <Button href={bookingUrl} style={button}>
          View Booking Details
        </Button>
      </Section>

      <Text style={paragraph}>
        You'll receive check-in instructions 24 hours before your arrival.
      </Text>

      <Text style={paragraph}>
        If you have any questions, please don't hesitate to contact us.
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

const infoBox = {
  backgroundColor: '#f8f9fa',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const infoTitle = {
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 16px',
  color: '#1a1a1a',
};

const infoRow = {
  marginBottom: '12px',
};

const infoLabel = {
  fontSize: '14px',
  color: '#737373',
  width: '120px',
};

const infoValue = {
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

export default BookingConfirmation;
