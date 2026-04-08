import * as React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

export interface EmailVerificationEmailProps {
  userName: string;
  verifyUrl: string;
}

export function EmailVerificationEmail({ userName, verifyUrl }: EmailVerificationEmailProps) {
  return (
    <BaseLayout preview="Confirme seu email no Hope Saúde">
      <Section>
        <Text style={{ fontSize: '16px', color: '#0f172a' }}>Bem-vindo, {userName}!</Text>
        <Text style={{ fontSize: '14px', color: '#334155' }}>
          Para ativar sua conta no Hope Saúde, precisamos confirmar seu email. Clique no botão
          abaixo. Este link é válido por 24 horas.
        </Text>
        <Section style={{ margin: '24px 0' }}>
          <Button
            href={verifyUrl}
            style={{
              backgroundColor: '#0f766e',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            confirmar seu email
          </Button>
        </Section>
        <Text style={{ fontSize: '12px', color: '#64748b' }}>
          Se o botão não funcionar, copie e cole este link no navegador: {verifyUrl}
        </Text>
      </Section>
    </BaseLayout>
  );
}
