import { test, expect } from '@playwright/test';

test.describe('Hope Saúde - Fluxo Crítico', () => {

  test('Fluxo completo: Registro -> Login -> Agenda -> Checkout PIX', async ({ page }) => {
    const ts = Date.now();
    const doctorName = `DrPW${ts}`;
    const doctorEmail = `doctor-${ts}@test.com`;
    const patientEmail = `patient-${ts}@test.com`;

    const waitReady = async () => {
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle');
    };

    // ─── 1. Registro do Médico ───
    await page.goto('/register');
    await waitReady();
    await page.fill('input[placeholder="Nome Completo"]', doctorName);
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('label:has-text("Médico")');
    await page.click('button:has-text("Cadastrar")');
    await page.waitForURL(/\/login/, { timeout: 15000 });

    // ─── 2. Login do Médico ───
    await page.goto('/login');
    await waitReady();
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('button:has-text("Entrar")');
    await page.waitForURL(/\/dashboard\/doctor/, { timeout: 15000 });

    // Médico novo: setup do perfil
    await page.goto('/setup/doctor');
    await waitReady();
    await page.waitForSelector('input[placeholder*="Especialidade"]', { timeout: 10000 });
    await page.fill('input[placeholder*="Especialidade"]', 'Psiquiatria');
    await page.fill('input[placeholder="CRM"]', `CRM${ts}`);
    await page.click('button:has-text("Finalizar Setup")');
    await page.waitForURL(/\/dashboard\/doctor/, { timeout: 15000 });

    // ─── 3. Médico define disponibilidade ───
    await waitReady();
    await page.waitForSelector('h1:has-text("Painel do Médico")', { timeout: 15000 });

    const gridCell = page.locator('.cursor-pointer').first();
    await gridCell.waitFor({ state: 'visible', timeout: 10000 });
    await gridCell.click();

    await expect(page.locator('text=Definir Disponibilidade')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Adicionar Slot")');
    await expect(page.locator('text=Disponível')).toBeVisible({ timeout: 5000 });

    const doctorUserId = await page.evaluate(() => {
      const t = localStorage.getItem('token');
      if (!t) return null;
      return JSON.parse(atob(t.split('.')[1])).sub as number;
    });
    expect(doctorUserId).toBeTruthy();

    // ─── 4. Registro do Paciente ───
    await page.goto('/register');
    await waitReady();
    await page.fill('input[placeholder="Nome Completo"]', 'Paciente Playwright');
    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('label:has-text("Paciente")');
    await page.click('button:has-text("Cadastrar")');
    await page.waitForURL(/\/login/, { timeout: 15000 });

    // ─── 5. Login do Paciente → Home ───
    await page.goto('/login');
    await waitReady();
    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('button:has-text("Entrar")');
    await page.waitForURL('http://localhost:3001/', { timeout: 15000 });

    await waitReady();

    await page.route('**/payments/checkout', async (route) => {
      // Se não tiver mockado o setup, primeira vez pode ser MISSING_PATIENT_PROFILE
      // Mas para o E2E, interceptamos para simular sucesso SE já preencheu.
      // O mock intercepta TUDO, então precisamos de lógica.
      const postData = route.request().postDataJSON();
      // O frontend tenta o checkout logo de cara
      // Vamos assumir que a chamada original (sem mock) passaria se tiver CPF
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      
      // Simulação: se tivermos no contexto da página algo que diga que o setup não foi feito,
      // retornamos 400. Vamos deixar a chamada passar pro backend real para ver o erro 400,
      // e só mockamos o SUCESSO (segunda chamada)
      await route.continue(); // Deixa ir pro backend real
    });

    // ─── 6. Paciente inicia checkout (consulta só existe após pagamento confirmado) ───
    await waitReady();
    await page.goto(`/doctors/${doctorUserId}`);
    await page.waitForLoadState('domcontentloaded');

    await page.click('button:has-text("Ver horários e agendar")');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    
    // Clica em Agendar: como não tem CPF, o backend vai retornar MISSING_PATIENT_PROFILE
    await page.getByRole('dialog').getByRole('button', { name: 'Agendar', exact: true }).first().click();
    
    // Deve aparecer o modal de Complete seu cadastro
    await expect(page.locator('text=Complete seu cadastro')).toBeVisible({ timeout: 10000 });
    
    // Preenche o modal
    await page.fill('input[placeholder="000.000.000-00"]', '12345678909');
    await page.fill('input[placeholder="(00) 00000-0000"]', '11999999999');
    
    // Agora mockamos o checkout para sucesso na segunda tentativa (já que o setup vai ser real)
    await page.route('**/payments/checkout', async (route) => {
      if (route.request().method() === 'POST') {
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
      } else {
        await route.continue();
      }
    });
    const corsPix = {
      'Access-Control-Allow-Origin': 'http://localhost:3001',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    };
    await page.route('**/payments/pix-qr/**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsPix });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsPix,
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

  test('Segurança: acesso sem login não mostra dashboard', async ({ page }) => {
    await page.goto('/dashboard/doctor');
    await expect(page.locator('text=Painel do Médico')).not.toBeVisible();
  });
});
