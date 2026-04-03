import { test, expect } from '@playwright/test';

test.describe('Fluxo de Agendamento e Pagamento (Asaas)', () => {
  test.describe.configure({ timeout: 180000 });

  test('deve agendar uma consulta e exibir PIX integrado na página', async ({ page }) => {
    const ts = Date.now();
    const doctorName = `Dr Pagamento ${ts}`;
    const doctorEmail = `dr-pay-${ts}@test.com`;
    const patientEmail = `patient-pay-${ts}@test.com`;

    // 1. Cadastra o Médico
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[placeholder="Nome Completo"]', doctorName);
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await expect(page.locator('input[placeholder="E-mail"]')).toHaveValue(doctorEmail, { timeout: 10000 });
    await page.click('label:has-text("Médico")');
    const regRes = page.waitForResponse(
      (res) => res.url().includes('/auth/register') && res.ok(),
      { timeout: 120000 },
    );
    await page.click('button:has-text("Cadastrar")');
    await regRes;
    await page.waitForURL(/\/login/, { timeout: 60000 });

    await page.goto('/login');
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('button:has-text("Entrar")');
    await page.waitForURL(/\/dashboard\/doctor/);

    // 2. Setup e Disponibilidade
    await page.goto('/setup/doctor');
    await page.fill('input[placeholder*="Especialidade"]', 'Psiquiatria');
    await page.fill('input[placeholder="CRM"]', `CRM-${ts}`);
    await page.click('button:has-text("Finalizar Setup")');
    await page.waitForURL(/\/dashboard\/doctor/);

    await page.click('text=Segunda'); 
    await page.locator('.cursor-pointer').first().click();
    await page.click('button:has-text("Adicionar Slot")');
    await expect(page.locator('text=Disponível')).toBeVisible();

    const doctorUserId = await page.evaluate(() => {
      const t = localStorage.getItem('token');
      if (!t) return null;
      return JSON.parse(atob(t.split('.')[1])).sub;
    });

    // 3. Cadastra o Paciente
    await page.evaluate(() => localStorage.clear());
    await page.goto('/register');
    await page.fill('input[placeholder="Nome Completo"]', 'Paciente Pagador');
    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await expect(page.locator('input[placeholder="E-mail"]')).toHaveValue(patientEmail);
    await page.click('label:has-text("Paciente")');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/register') && res.ok()),
      page.click('button:has-text("Cadastrar")'),
    ]);
    await page.waitForURL(/\/login/);

    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('button:has-text("Entrar")');
    await page.waitForURL(/localhost:3001\/?$/);

    // Removemos o mock genérico do checkout aqui. Vamos mockar só o sucesso.
    // 4. Acessa perfil do médico
    await page.goto(`/doctors/${doctorUserId}`);
    await page.waitForLoadState('domcontentloaded');
    
    // 5. Clica para Agendar e Finalizar o Pagamento
    await page.click('button:has-text("Ver horários e agendar")');
    
    // Intercepta a primeira chamada que dará erro (sem CPF) -> vamos deixar ir pro backend real 
    // ou podemos mockar o 400. Vamos mockar o 400 para garantir estabilidade E2E
    await page.route('**/payments/checkout', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'MISSING_PATIENT_PROFILE',
          message: 'Falta CPF',
        }),
      });
    }, { times: 1 });

    await page.getByRole('dialog').getByRole('button', { name: 'Agendar', exact: true }).first().click();

    // Modal de setup aparece
    await expect(page.locator('text=Complete seu cadastro')).toBeVisible({ timeout: 10000 });
    await page.fill('input[placeholder="000.000.000-00"]', '12345678909');
    await page.fill('input[placeholder="(00) 00000-0000"]', '11999999999');

    // Mock segunda chamada: cobrança sem QR (QR vem em GET separado)
    await page.route('**/payments/checkout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paymentId: 'pay_e2e_mock',
          paymentMethod: 'PIX',
          invoiceUrl: 'https://sandbox.asaas.com/e2e-pix',
          value: 150,
          pixQrPending: true,
        }),
      });
    });
    const cors = {
      'Access-Control-Allow-Origin': 'http://localhost:3001',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    };
    await page.route('**/payments/pix-qr/**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: cors });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({
          pixQrCode:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          pixCode: '00020126580014br.gov.bcb.pix0136e2e-test',
          pixExpiresAt: '2026-12-31T23:59:59.000Z',
        }),
      });
    });

    await page.click('button:has-text("Salvar e Continuar")');

    await expect(page.getByRole('heading', { name: 'Pagamento da consulta' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Pagamento PIX' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('img', { name: 'QR Code PIX' })).toBeVisible();
  });

  test('deve agendar com Cartão de Crédito e exibir mensagem de recusa do gateway', async ({ page }) => {
    const ts = Date.now();
    const doctorEmail = `dr-card-${ts}@test.com`;
    const patientEmail = `patient-card-${ts}@test.com`;

    // 1. Setup Médico
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[placeholder="Nome Completo"]', 'Dr Card');
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('label:has-text("Médico")');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/register') && res.ok()),
      page.click('button:has-text("Cadastrar")'),
    ]);
    await page.goto('/login');
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('button:has-text("Entrar")');
    await page.waitForURL(/\/dashboard\/doctor/);

    await page.goto('/setup/doctor');
    await page.fill('input[placeholder*="Especialidade"]', 'Cardiologia');
    await page.fill('input[placeholder="CRM"]', `CRM-${ts}`);
    await page.click('button:has-text("Finalizar Setup")');
    await page.waitForURL(/\/dashboard\/doctor/);

    await page.click('text=Segunda'); 
    await page.locator('.cursor-pointer').first().click();
    await page.click('button:has-text("Adicionar Slot")');
    await expect(page.locator('text=Disponível')).toBeVisible();

    const doctorUserId = await page.evaluate(() => {
      const t = localStorage.getItem('token');
      return JSON.parse(atob(t!.split('.')[1])).sub;
    });

    // 2. Setup Paciente
    await page.evaluate(() => localStorage.clear());
    await page.goto('/register');
    await page.fill('input[placeholder="Nome Completo"]', 'Paciente Cartão');
    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('label:has-text("Paciente")');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/register') && res.ok()),
      page.click('button:has-text("Cadastrar")'),
    ]);
    await page.goto('/login');
    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('button:has-text("Entrar")');
    await page.waitForURL(/localhost:3001\/?$/);

    // 3. Acessa médico e Mock da Rota Checkout
    await page.goto(`/doctors/${doctorUserId}`);
    await page.waitForLoadState('domcontentloaded');

    await page.route('**/payments/checkout', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        if (body?.paymentMethod === 'PIX') {
          // Erro no PIX só pra forçar a ida pro Cartão sem problemas
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'PIX indiponível' }),
          });
        } else if (body?.paymentMethod === 'CREDIT_CARD') {
          // Recusa do emissor
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Cartão recusado pelo emissor.' }),
          });
        }
      } else {
        await route.continue();
      }
    });

    await page.click('button:has-text("Ver horários e agendar")');
    await page.getByRole('dialog').getByRole('button', { name: 'Agendar', exact: true }).first().click();

    // Como falta CPF, mockamos o cadastro
    await expect(page.locator('text=Complete seu cadastro')).toBeVisible({ timeout: 10000 });
    await page.fill('input[placeholder="000.000.000-00"]', '12345678909');
    await page.fill('input[placeholder="(00) 00000-0000"]', '11999999999');
    await page.click('button:has-text("Salvar e Continuar")');

    await expect(page.getByRole('heading', { name: 'Pagamento da consulta' })).toBeVisible({ timeout: 10000 });

    // Alternar para aba de Cartão de Crédito
    await page.click('button:has-text("Cartão de crédito")');

    // Preencher dados
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome no cartão').fill('Paciente T');
    await dialog.getByLabel('Número do cartão').fill('0000000000000000');
    await dialog.getByLabel('Mês').fill('12');
    await dialog.getByLabel('Ano').fill('2030');
    await dialog.getByLabel('CVV').fill('123');
    await dialog.getByLabel('CEP').fill('01000000');
    await dialog.getByLabel('Número').fill('10');

    await page.click('button:has-text("Pagar com cartão")');

    // Asserção do erro
    await expect(page.getByText('Cartão recusado pelo emissor.')).toBeVisible({ timeout: 10000 });
  });
});
