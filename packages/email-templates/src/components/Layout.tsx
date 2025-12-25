import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Img,
} from '@react-email/components';
import * as React from 'react';

interface LayoutProps {
  previewText: string;
  children: React.ReactNode;
}

export function Layout({ previewText, children }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={heading}>PropFlow360</Text>
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              © 2024 PropFlow360. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href="{{unsubscribeUrl}}" style={link}>
                Unsubscribe
              </Link>
              {' · '}
              <Link href="https://propflow360.com/privacy" style={link}>
                Privacy Policy
              </Link>
              {' · '}
              <Link href="https://propflow360.com/terms" style={link}>
                Terms of Service
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  padding: '32px 24px',
  backgroundColor: '#0070f3',
};

const heading = {
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#ffffff',
  margin: '0',
  textAlign: 'center' as const,
};

const content = {
  padding: '0 24px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

const footer = {
  padding: '0 24px',
};

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
  margin: '8px 0',
};

const link = {
  color: '#0070f3',
  textDecoration: 'none',
};
