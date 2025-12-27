import { Text, Section, Row, Column, Button } from '@react-email/components';
import * as React from 'react';
import { Layout } from './components/Layout';

interface MaintenanceUpdateProps {
  recipientName: string;
  ticketNumber: string;
  title: string;
  status: string;
  priority: string;
  propertyName: string;
  unitName?: string;
  updateMessage: string;
  assignedTo?: string;
  ticketUrl: string;
}

export function MaintenanceUpdate({
  recipientName,
  ticketNumber,
  title,
  status,
  priority,
  propertyName,
  unitName,
  updateMessage,
  assignedTo,
  ticketUrl,
}: MaintenanceUpdateProps) {
  return (
    <Layout previewText={`Maintenance Update - ${ticketNumber}`}>
      <Text style={titleStyle}>Maintenance Ticket Update</Text>

      <Text style={paragraph}>Hi {recipientName},</Text>

      <Text style={paragraph}>
        There's been an update to your maintenance ticket.
      </Text>

      <Section style={ticketBox}>
        <Text style={ticketTitleStyle}>{title}</Text>
        <Text style={ticketNumberStyle}>{ticketNumber}</Text>

        <Row style={{ marginTop: '16px' }}>
          <Column>
            <span style={getStatusBadge(status)}>{status.toUpperCase()}</span>
            {' '}
            <span style={getPriorityBadge(priority)}>{priority.toUpperCase()}</span>
          </Column>
        </Row>
      </Section>

      <Section style={updateBox}>
        <Text style={updateLabel}>Update:</Text>
        <Text style={updateMessageStyle}>{updateMessage}</Text>
      </Section>

      <Section style={detailsBox}>
        <Row style={detailRow}>
          <Column style={detailLabel}>Property:</Column>
          <Column style={detailValue}>
            {propertyName}{unitName ? ` - ${unitName}` : ''}
          </Column>
        </Row>

        {assignedTo && (
          <Row style={detailRow}>
            <Column style={detailLabel}>Assigned To:</Column>
            <Column style={detailValue}>{assignedTo}</Column>
          </Row>
        )}
      </Section>

      <Section style={buttonContainer}>
        <Button href={ticketUrl} style={button}>
          View Ticket Details
        </Button>
      </Section>

      <Text style={paragraph}>
        You'll receive updates as we make progress on this ticket.
      </Text>

      <Text style={signature}>
        Best regards,<br />
        The PropFlow360 Team
      </Text>
    </Layout>
  );
}

function getStatusBadge(status: string) {
  const defaultStyle = { bg: '#dbeafe', color: '#1e40af' };
  const colors: Record<string, { bg: string; color: string }> = {
    open: defaultStyle,
    in_progress: { bg: '#fef3c7', color: '#92400e' },
    resolved: { bg: '#d1fae5', color: '#065f46' },
    closed: { bg: '#f3f4f6', color: '#374151' },
  };

  const style = colors[status] ?? defaultStyle;

  return {
    ...badge,
    backgroundColor: style.bg,
    color: style.color,
  };
}

function getPriorityBadge(priority: string) {
  const defaultStyle = { bg: '#fef3c7', color: '#92400e' };
  const colors: Record<string, { bg: string; color: string }> = {
    low: { bg: '#f3f4f6', color: '#374151' },
    medium: defaultStyle,
    high: { bg: '#fed7aa', color: '#9a3412' },
    urgent: { bg: '#fee2e2', color: '#991b1b' },
  };

  const style = colors[priority] ?? defaultStyle;

  return {
    ...badge,
    backgroundColor: style.bg,
    color: style.color,
  };
}

const titleStyle = {
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

const ticketBox = {
  backgroundColor: '#f8f9fa',
  borderLeft: '4px solid #0070f3',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const ticketTitleStyle = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1a1a1a',
  margin: '0 0 8px',
};

const ticketNumberStyle = {
  fontSize: '14px',
  color: '#737373',
  margin: '0',
};

const badge = {
  display: 'inline-block',
  padding: '4px 12px',
  borderRadius: '12px',
  fontSize: '12px',
  fontWeight: 'bold',
  marginRight: '8px',
};

const updateBox = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const updateLabel = {
  fontSize: '12px',
  fontWeight: 'bold',
  color: '#1e40af',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px',
};

const updateMessageStyle = {
  fontSize: '15px',
  color: '#1a1a1a',
  lineHeight: '22px',
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

export default MaintenanceUpdate;
