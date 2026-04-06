import { test, expect } from '@playwright/test';

test.describe('Hope Saúde - Fluxo de Prontuário Médico', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('Médico deve conseguir criar, visualizar, editar e assinar um prontuário', async ({ page }) => {
    const ts = Date.now();
    const doctorName = `DrMedical${ts}`;
    const doctorEmail = `doc-med-${ts}@test.com`;
    const patientName = `Paciente Med${ts}`;
    const patientEmail = `pat-med-${ts}@test.com`;

    const waitReady = async () => {
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle');
    };

    // ─── 1. Registro do Médico ───
    await page.goto('/register');
    await page.fill('input[placeholder="Nome Completo"]', doctorName);
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('label:has-text("Médico")');
    await page.getByRole('button', { name: /criar minha conta/i }).click();
    await page.waitForURL(/\/dashboard\/doctor/);

    // Setup do perfil do médico
    await page.goto('/setup/doctor');
    await page.fill('input[placeholder*="Especialidade"]', 'Clínica Geral');
    await page.fill('input[placeholder="CRM"]', `CRM-MED-${ts}`);
    await page.click('button:has-text("Finalizar Setup")');
    await page.waitForURL(/\/dashboard\/doctor/);

    // Pegar o ID do médico para o paciente agendar
    const doctorUserId = await page.evaluate(() => {
      const t = localStorage.getItem('token');
      return JSON.parse(atob(t!.split('.')[1])).sub;
    });

    // ─── 2. Registro do Paciente e Agendamento ───
    await page.goto('/register');
    await page.fill('input[placeholder="Nome Completo"]', patientName);
    await page.fill('input[placeholder="E-mail"]', patientEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('label:has-text("Paciente")');
    await page.getByRole('button', { name: /criar minha conta/i }).click();
    await page.waitForURL('http://localhost:3001/');

    // Agendar consulta com o médico
    await page.goto(`/doctors/${doctorUserId}`);
    await page.click('button:has-text("Ver horários e agendar")');
    
    // Como precisamos de um agendamento CONFIRMADO para o prontuário, vamos mockar o checkout para sucesso imediato
    // E usar o botão "Marcar como Pago" que criamos para ambiente de teste
    await page.route('**/payments/checkout', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ paymentId: `pay_${ts}`, paymentMethod: 'PIX', pixQrPending: true })
      });
    });

    // Clica no primeiro horário disponível
    await page.getByRole('button', { name: 'Agendar' }).first().click();

    // Setup do paciente (CPF/Telefone)
    await page.fill('input[placeholder="000.000.000-00"]', '12345678901');
    await page.fill('input[placeholder="(00) 00000-0000"]', '11988887777');
    await page.click('button:has-text("Salvar e Continuar")');

    // Confirmar pagamento manualmente (Recurso de teste)
    await page.waitForSelector('button:has-text("Marcar como Pago")');
    await page.click('button:has-text("Marcar como Pago")');
    await expect(page.locator('text=Consulta Confirmada!')).toBeVisible();
    await page.click('button:has-text("Ver meus agendamentos")');

    // ─── 3. Médico acessa Agenda e abre Prontuário ───
    // Volta para o login como médico (limpando storage)
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.fill('input[placeholder="E-mail"]', doctorEmail);
    await page.fill('input[placeholder="Senha"]', 'secret123');
    await page.click('button:has-text("Entrar")');
    
    await page.goto('/agenda');
    await waitReady();

    // Clica no bloco da consulta (deve ter o nome do paciente)
    // Usamos o locator para garantir que clicamos no elemento correto da agenda
    const appointmentBlock = page.locator(`text=${patientName}`).first();
    await appointmentBlock.click();
    
    // Verifica se o modal de prontuário abriu
    await expect(page.locator(`text=Prontuário: ${patientName}`)).toBeVisible();

    // ─── 4. Operações no Prontuário ───
    // Usar template SOAP
    await page.click('button:has-text("ADICIONAR TEMPLATE SOAP")');
    
    // Salvar rascunho
    await page.click('button:has-text("Salvar Rascunho")');
    
    // Verificar histórico
    await page.click('button:has-text("Histórico (1)")');
    await expect(page.locator('text=RASCUNHO')).toBeVisible();

    // Pesquisar no histórico
    await page.fill('input[placeholder="Pesquisar..."]', 'Subjetivo');
    await expect(page.locator('text=S (Subjetivo)')).toBeVisible();

    // Assinar prontuário
    await page.click('button:has-text("Editar")'); // Volta para a aba de edição
    page.once('dialog', dialog => dialog.accept()); // Aceita o confirm()
    await page.click('button:has-text("Finalizar e Assinar")');
    
    // Verifica se ficou assinado e bloqueado
    await expect(page.locator('text=Este prontuário já foi assinado')).toBeVisible();
    await expect(page.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');
  });
});
