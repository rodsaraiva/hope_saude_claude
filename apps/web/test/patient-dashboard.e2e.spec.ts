import { test, expect } from '@playwright/test';

test.describe('Dashboard do Paciente (Listagem de Consultas)', () => {
  test.describe.configure({ timeout: 120000 });

  test('deve listar as consultas confirmadas e exibir link para teleconsulta', async ({ page }) => {
    const ts = Date.now();
    const doctorEmail = `dr-list-${ts}@test.com`;
    const patientEmail = `patient-list-${ts}@test.com`;

    // Vamos mockar toda a API para testar apenas a listagem e o layout!
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ userId: 10, role: 'PATIENT' }),
      });
    });

    await page.route('**/appointments/me', async (route) => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            doctorId: 5,
            date: futureDate.toISOString(),
            status: 'CONFIRMED',
            doctor: {
              specialty: 'Psiquiatria',
              user: { name: 'Dr. Teste Mock' },
            },
          },
          {
            id: 2,
            doctorId: 5,
            date: pastDate.toISOString(),
            status: 'COMPLETED',
            doctor: {
              specialty: 'Psiquiatria',
              user: { name: 'Dr. Teste Mock' },
            },
          }
        ]),
      });
    });

    // Mock das chamadas auxiliares que podem travar a UI (Profile)
    await page.route('**/profile/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, cpf: '123' }),
      });
    });

    // Precisamos de um localstorage para o AuthGuard do front não barrar
    await page.goto('/');
    await page.evaluate(() => {
      // Mock de um JWT válido para bypass local (payload com role PATIENT e exp no futuro)
      const payload = btoa(JSON.stringify({ sub: 10, role: 'PATIENT', exp: 9999999999 }));
      localStorage.setItem('token', `header.${payload}.signature`);
    });

    await page.goto('/dashboard/patient');
    await page.waitForLoadState('domcontentloaded');

    // Asserções na página do painel
    await expect(page.getByRole('heading', { name: 'Minhas Consultas' })).toBeVisible();

    // Verificando a primeira consulta (Futura / Confirmada)
    const activeAppointment = page.locator('article').filter({ hasText: 'Confirmada' });
    await expect(activeAppointment).toBeVisible({ timeout: 10000 });
    await expect(activeAppointment).toContainText('Dr. Teste Mock');
    await expect(activeAppointment).toContainText('Psiquiatria');
    
    // Verificando o botão da sala de vídeo
    const videoBtn = activeAppointment.getByRole('link', { name: 'Acessar Sala de Vídeo' });
    await expect(videoBtn).toBeVisible();
    await expect(videoBtn).toHaveAttribute('href', '/appointments/1/video');

    // Verificando a segunda consulta (Passada / Completa)
    const pastAppointment = page.locator('article').filter({ hasText: 'Realizada' });
    await expect(pastAppointment).toBeVisible();
    await expect(pastAppointment).toContainText('Dr. Teste Mock');
  });
});
