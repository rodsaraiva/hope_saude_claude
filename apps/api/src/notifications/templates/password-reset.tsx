import * as React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

export interface PasswordResetEmailProps {
  userName: string;
  resetUrl: string;
}

export function PasswordResetEmail({ userName, resetUrl }: PasswordResetEmailProps) {
  return (
    <BaseLayout preview="Redefina sua senha do Hope Saúde">
      <Section>
        <Text style={{ fontSize: '16px', color: '#0f172a' }}>Olá, {userName}.</Text>
        <Text style={{ fontSize: '14px', color: '#334155' }}>
          Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para continuar.
          Este link é válido por 1 hora. Se você não solicitou, ignore esta mensagem.
        </Text>
        <Section style={{ margin: '24px 0' }}>
          <Button
            href={resetUrl}
            style={{
              backgroundColor: '#0f766e',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            redefinir sua senha
          </Button>
        </Section>
        <Text style={{ fontSize: '12px', color: '#64748b' }}>
          Se o botão não funcionar, copie e cole este link no navegador: {resetUrl}
        </Text>
      </Section>
    </BaseLayout>
  );
}
