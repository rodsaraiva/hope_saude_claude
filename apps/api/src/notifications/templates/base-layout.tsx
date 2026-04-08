import * as React from 'react';
import { Body, Container, Head, Html, Preview, Section, Text } from '@react-email/components';

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: '#f4f6f8',
          fontFamily: 'Arial, sans-serif',
          margin: 0,
          padding: '24px',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '32px',
            maxWidth: '560px',
          }}
        >
          <Section>
            <Text
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#0f766e',
                margin: '0 0 16px 0',
              }}
            >
              Hope Saúde
            </Text>
          </Section>
          {children}
          <Section>
            <Text style={{ fontSize: '12px', color: '#64748b', marginTop: '32px' }}>
              Este é um email automático. Não responda.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
