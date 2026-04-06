import { test, expect } from '@playwright/test';

test.describe('Perfil do médico (paciente)', () => {
  test('sem login: acesso redireciona para login', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/doctors/1');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('URL legada /dashboard/patient/doctors/:id redireciona para /doctors/:id', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dashboard/patient/doctors/42');
    await expect(page).toHaveURL(/\/doctors\/42/, { timeout: 10000 });
  });

  test('paciente logado: médico inexistente exibe mensagem de não encontrado', async ({ page }) => {
    const ts = Date.now();
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[placeholder="Nome Completo"]', `Paciente Perfil ${ts}`);
    await page.fill('input[placeholder="E-mail"]', `patient-profile-${ts}@test.com`);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('label:has-text("Paciente")');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/register') && res.ok()),
      page.getByRole('button', { name: /criar minha conta/i }).click(),
    ]);
    await page.waitForURL(/localhost:3001\/?$/, { timeout: 60000 });

    await page.goto('/doctors/999999');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Médico não encontrado/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('paciente logado: perfil exibe nome, especialidade e CRM', async ({ page }) => {
    const ts = Date.now();
    const doctorName = `DrPerfil${ts}`;
    const doctorEmail = `doctor-profile-${ts}@test.com`;
    const patientEmail = `patient-view-${ts}@test.com`;

    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[placeholder="Nome Completo"]', doctorName);
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await expect(page.locator('input[placeholder="E-mail"]')).toHaveValue(doctorEmail);
    await page.click('label:has-text("Médico")');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/register') && res.ok()),
      page.getByRole('button', { name: /criar minha conta/i }).click(),
    ]);
    await page.waitForURL(/\/dashboard\/doctor/, { timeout: 60000 });

    await page.goto('/setup/doctor');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('input[placeholder*="Especialidade"]', { timeout: 10000 });
    await page.fill('input[placeholder*="Especialidade"]', 'Psiquiatria Clínica');
    await page.fill('input[placeholder="CRM"]', `CRM${ts}`);
    await page.click('button:has-text("Finalizar Setup")');
    await page.waitForURL(/\/dashboard\/doctor/, { timeout: 15000 });

    const doctorUserId = await page.evaluate(() => {
      const t = localStorage.getItem('token');
      if (!t) return null;
      try {
        const p = JSON.parse(atob(t.split('.')[1])) as { sub?: number; userId?: number };
        return p.sub ?? p.userId ?? null;
      } catch {
        return null;
      }
    });
    expect(doctorUserId).toBeTruthy();

    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[placeholder="Nome Completo"]', 'Paciente View');
    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await expect(page.locator('input[placeholder="E-mail"]')).toHaveValue(patientEmail);
    await page.click('label:has-text("Paciente")');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/register') && res.ok()),
      page.getByRole('button', { name: /criar minha conta/i }).click(),
    ]);
    await page.waitForURL(/localhost:3001\/?$/, { timeout: 60000 });

    await page.goto(`/doctors/${doctorUserId}`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(new RegExp(`/doctors/${doctorUserId}`), {
      timeout: 10000,
    });

    await expect(page.getByRole('heading', { name: `Dr. ${doctorName}` })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('region', { name: /Dados de cadastro/i }).getByText('Psiquiatria Clínica')).toBeVisible();
    await expect(page.getByRole('region', { name: /Dados de cadastro/i }).getByText(new RegExp(`CRM${ts}`))).toBeVisible();
    await expect(page.getByRole('region', { name: /Dados de cadastro/i }).getByText(doctorEmail)).toBeVisible();
    
    // Verifica se o Avatar está presente, mas não permite edição
    const avatarRegion = page.locator('.shrink-0').first();
    await expect(avatarRegion).toBeVisible();
    await expect(page.locator('label[title="Alterar foto de perfil"]')).toBeHidden();
  });
});
