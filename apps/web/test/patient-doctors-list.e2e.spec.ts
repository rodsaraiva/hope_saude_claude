import { test, expect } from '@playwright/test';

test.describe('Lista de médicos (paciente)', () => {
  test('sem login: acesso à lista redireciona para login', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dashboard/patient/doctors');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
