import { test, expect } from '@playwright/test';
import { AccessToken } from 'livekit-server-sdk';

test.describe('Videochamada (LiveKit)', () => {
  test('deve renderizar a interface de teleconsulta e obter token LiveKit', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const ts = Date.now();
    const patientEmail = `patient-video-${ts}@test.com`;

    const at = new AccessToken('MOCK_API_KEY', 'MOCK_API_SECRET', {
      identity: patientEmail,
    });
    at.addGrant({ roomJoin: true, room: 'room-999' });
    const mockLivekitToken = await at.toJwt();

    await page.route('**/video/token/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: mockLivekitToken,
          roomName: 'room-999',
          livekitUrl: 'ws://127.0.0.1:59999',
        }),
      });
    });

    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    await page.fill('input[placeholder="Nome Completo"]', 'Paciente Video');
    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await expect(page.locator('input[placeholder="E-mail"]')).toHaveValue(patientEmail);
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

    await page.goto('/appointments/999/video');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1', { hasText: 'Teleconsulta' })).toBeVisible({ timeout: 15000 });

    await expect(page.getByText(/Aguardando|Conectando/i).first()).toBeVisible();

    await expect(page.getByRole('button', { name: 'Desligar' })).toBeVisible();

    await expect(page.getByRole('main')).toBeVisible();

    await context.close();
  });
});
