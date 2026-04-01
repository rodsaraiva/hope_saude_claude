import { test, expect } from '@playwright/test';

test.describe('Navbar - Global Navigation', () => {
  
  test('Deve exibir a Navbar na página inicial', async ({ page }) => {
    await page.goto('/');
    const navbar = page.locator('header');
    await expect(navbar).toBeVisible();
    await expect(navbar.getByText('Hope Saúde')).toBeVisible();
  });

  test('Deve exibir a Navbar na página de login', async ({ page }) => {
    await page.goto('/login');
    // Este teste deve falhar inicialmente pois a Navbar ainda não foi movida para o layout global
    const navbar = page.locator('header');
    await expect(navbar).toBeVisible({ timeout: 5000 });
    await expect(navbar.getByText('Hope Saúde')).toBeVisible();
  });

  test('Deve exibir links básicos na Navbar quando deslogado', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    const navbar = page.locator('header');
    await expect(navbar.getByRole('link', { name: 'Entrar' })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Criar conta' })).toBeVisible();
  });
});
