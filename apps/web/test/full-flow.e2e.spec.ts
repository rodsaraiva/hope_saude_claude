import { test, expect } from '@playwright/test';

test.describe('Hope Saúde - Fluxo Crítico', () => {

  test('Fluxo completo: Registro -> Login -> Agenda -> Agendamento -> Vídeo', async ({ page }) => {
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
    await page.waitForSelector('text=Meu Painel', { timeout: 10000 });
    await page.click('text=Meu Painel');
    await page.waitForURL(/\/dashboard\/patient/, { timeout: 15000 });

    // ─── 6. Paciente agenda consulta com o médico correto ───
    await waitReady();
    // Nosso médico é sempre o último criado → último botão da lista
    const verButtons = page.locator('button:has-text("Ver Disponibilidade")');
    await verButtons.last().click();
    await expect(page.locator(`h3:has-text("${doctorName}")`)).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Agendar")');
    await expect(page.locator('text=PENDING')).toBeVisible({ timeout: 10000 });

    // ─── 7. Médico confirma consulta ───
    await page.goto('/login');
    await waitReady();
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('button:has-text("Entrar")');
    await page.waitForURL(/\/dashboard\/doctor/, { timeout: 15000 });
    await waitReady();
    await page.reload();
    await waitReady();

    await page.waitForSelector('button:has-text("Confirmar Consulta")', { timeout: 15000 });
    await page.click('button:has-text("Confirmar Consulta")');
    await expect(page.locator('text=Confirmada')).toBeVisible({ timeout: 10000 });

    // ─── 8. Paciente entra na sala de vídeo ───
    await page.goto('/login');
    await waitReady();
    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('button:has-text("Entrar")');
    await page.waitForURL('http://localhost:3001/', { timeout: 15000 });

    await page.goto('/dashboard/patient');
    await waitReady();

    await page.waitForSelector('a:has-text("Entrar na Consulta")', { timeout: 15000 });
    await page.click('a:has-text("Entrar na Consulta")');
    await expect(page).toHaveURL(/\/video\/\d+/);
    // Espera hidratação completa (fetch do token + React mount)
    await waitReady();
    await expect(page.locator('text=Sala de Consulta')).toBeVisible();
    await page.waitForSelector('button:has-text("Entrar na Chamada")', { timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.click('button:has-text("Entrar na Chamada")');
    await expect(page.locator('text=Conectado')).toBeVisible({ timeout: 10000 });
  });

  test('Segurança: acesso sem login não mostra dashboard', async ({ page }) => {
    await page.goto('/dashboard/doctor');
    await expect(page.locator('text=Painel do Médico')).not.toBeVisible();
  });
});
