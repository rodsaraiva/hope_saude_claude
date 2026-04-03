import { test, expect } from '@playwright/test';

test.describe('Perfil Detalhado do Médico (TDD)', () => {
  test('médico deve ver sua disponibilidade em seu próprio perfil', async ({ page }) => {
    const ts = Date.now();
    const doctorName = `DrTDD${ts}`;
    const doctorEmail = `dr-tdd-${ts}@test.com`;

    // 1. Registro e Login
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[placeholder="Nome Completo"]', doctorName);
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await expect(page.locator('input[placeholder="Nome Completo"]')).toHaveValue(doctorName);
    await page.click('label:has-text("Médico")');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/register') && res.ok()),
      page.click('button:has-text("Cadastrar")'),
    ]);
    await page.waitForURL(/\/login/, { timeout: 60000 });
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await expect(page.locator('input[placeholder="E-mail"]')).toHaveValue(doctorEmail);
    await page.click('button:has-text("Entrar")');
    await page.waitForURL(/\/dashboard\/doctor/, { timeout: 45000 });

    // 2. Setup do Perfil
    await page.goto('/setup/doctor');
    await page.fill('input[placeholder*="Especialidade"]', 'Psiquiatria TDD');
    await page.fill('input[placeholder="CRM"]', `CRM-TDD-${ts}`);
    await page.fill('textarea[placeholder*="biografia"]', 'Especialista em transtornos de ansiedade e depressão.');
    await page.click('button:has-text("Finalizar Setup")');
    await page.waitForURL(/\/dashboard\/doctor/);

    // 3. Adicionar Disponibilidade (no dashboard)
    await page.click('text=Segunda'); 
    await page.locator('.cursor-pointer').first().click();
    await page.click('button:has-text("Adicionar Slot")');
    await expect(page.locator('text=Disponível')).toBeVisible();

    // 4. Acessar Perfil e Verificar Dados + Disponibilidade
    const meRes = page.waitForResponse((r) => r.url().includes('/auth/me') && r.ok(), { timeout: 20000 });
    const profileRes = page.waitForResponse((r) => r.url().includes('/profile/me') && r.ok(), {
      timeout: 20000,
    });
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');
    await Promise.all([meRes, profileRes]);

    // Info básica
    await expect(page.locator('h1', { hasText: 'Meu perfil' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: /Dados de cadastro/i }).getByText(doctorName, { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Psiquiatria TDD').first()).toBeVisible();
    await expect(page.getByText(`CRM-TDD-${ts}`).first()).toBeVisible();
    await expect(page.getByText(/Especialista em transtornos/i)).toBeVisible();

    // Disponibilidade
    await expect(page.getByRole('heading', { name: /Disponibilidade/i })).toBeVisible();
    await expect(page.locator('section[aria-labelledby="disponibilidade-heading"]')).toContainText(/08:00/i);

    // 5. Pegar o Doctor User ID do JWT para verificar o link na lista
    const doctorUserId = await page.evaluate(() => {
      const t = localStorage.getItem('token');
      if (!t) return null;
      const p = JSON.parse(atob(t.split('.')[1]));
      return p.sub || p.userId;
    });

    // 6. Verificar Link na Lista de Médicos
    await page.evaluate(() => localStorage.clear());
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    const patientEmail = `p-tdd-${ts}@test.com`;
    await page.fill('input[placeholder="Nome Completo"]', 'Paciente TDD');
    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await expect(page.locator('input[placeholder="Nome Completo"]')).toHaveValue('Paciente TDD');
    await page.click('label:has-text("Paciente")');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/register') && res.ok()),
      page.click('button:has-text("Cadastrar")'),
    ]);
    await page.waitForURL(/\/login/, { timeout: 60000 });
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await expect(page.locator('input[placeholder="E-mail"]')).toHaveValue(patientEmail);
    await page.click('button:has-text("Entrar")');
    await page.waitForURL(/localhost:3001\/?$/, { timeout: 15000 });
    
    await page.goto('/dashboard/patient/doctors');
    await page.waitForLoadState('networkidle');
    const doctorCard = page.locator('article').filter({ hasText: doctorName });
    const profileLink = doctorCard.getByRole('link', { name: /Ver perfil/i });
    
    const href = await profileLink.getAttribute('href');
    expect(href).toBe(`/doctors/${String(doctorUserId)}`);
  });
});
