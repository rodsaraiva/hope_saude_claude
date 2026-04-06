import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentModal from '../src/components/PaymentModal';

// Mock global do fetch
global.fetch = jest.fn();

describe('PaymentModal', () => {
  const props = {
    open: true,
    onClose: jest.fn(),
    doctorUserId: 42,
    dateIso: '2026-05-01T10:00:00Z',
    onMissingProfile: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Storage.prototype.getItem = jest.fn(() => 'mock_token');
  });

  it('não deve renderizar quando open é falso', () => {
    const { container } = render(<PaymentModal {...props} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('deve renderizar modal com abas de PIX e Cartão', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    render(<PaymentModal {...props} />);
    expect(screen.getByRole('dialog', { name: /Pagamento da consulta/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /PIX/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Cartão/i })).toBeTruthy();
    await waitFor(() => {}); // clear acts
  });

  it('deve fechar o modal ao clicar no X', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    render(<PaymentModal {...props} />);
    const closeBtn = screen.getByRole('button', { name: 'Fechar' });
    await userEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalled();
    await waitFor(() => {}); // clear acts
  });

  describe('Aba PIX (Checkout flow)', () => {
    it('deve lidar com falha de conexão no checkout', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      render(<PaymentModal {...props} />);
      
      expect(screen.getByText('Gerando cobrança PIX…')).toBeTruthy();
      
      await waitFor(() => {
        expect(screen.getByText('Falha de conexão.')).toBeTruthy();
      });
    });

    it('deve chamar onMissingProfile quando receber 400 MISSING_PATIENT_PROFILE', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ code: 'MISSING_PATIENT_PROFILE' }),
      });

      render(<PaymentModal {...props} />);

      await waitFor(() => {
        expect(props.onMissingProfile).toHaveBeenCalled();
      });
    });

    it('deve concluir o fluxo de checkout e carregar QR Code com sucesso', async () => {
      // Setup de mocks: POST e GET
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ // checkout POST
          ok: true,
          json: async () => ({
            paymentId: 'pay_success',
            invoiceUrl: 'http://invoice',
            value: 150,
          }),
        })
        .mockResolvedValueOnce({ // pix-qr GET
          ok: true,
          json: async () => ({
            pixQrCode: 'mockqr',
            pixCode: 'mockcode',
            pixExpiresAt: '2026-05-02T10:00:00Z',
          }),
        });

      render(<PaymentModal {...props} />);

      // Verifica loading inicial
      expect(screen.getByText('Gerando cobrança PIX…')).toBeTruthy();

      // Verifica o painel populado após o fetch
      await waitFor(() => {
        expect(screen.getByText('Valor: R$ 150,00')).toBeTruthy();
        const codeOutput = screen.getByRole('status', { hidden: true }); 
        expect(codeOutput.textContent).toContain('mockcode');
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Aba Cartão de Crédito', () => {
    it('deve alternar para a aba de cartão e preencher formulário com sucesso', async () => {
      // Mock para a requisição PIX inicial
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      render(<PaymentModal {...props} />);
      
      // Muda para aba Cartão
      await userEvent.click(screen.getByRole('button', { name: /Cartão/i }));
      
      // Preenchimento de dados do formulário
      const nameInput = screen.getByLabelText(/Nome no cartão/i) as HTMLInputElement;
      const numInput = screen.getByLabelText(/Número do cartão/i) as HTMLInputElement;
      
      await userEvent.type(nameInput, 'Paciente Pagador');
      await userEvent.type(numInput, '5555444433332222');
      
      expect(nameInput.value).toBe('Paciente Pagador');
      expect(numInput.value).toBe('5555444433332222');
      
      await waitFor(() => {}); // clear acts
    });

    it('deve realizar o pagamento com cartão e exibir tela de sucesso', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      
      render(<PaymentModal {...props} />);
      await userEvent.click(screen.getByRole('button', { name: /Cartão/i }));
      
      // Preencher form básico (obrigatórios)
      await userEvent.type(screen.getByLabelText(/Nome no cartão/i), 'Paciente Pagador');
      await userEvent.type(screen.getByLabelText(/Número do cartão/i), '5555444433332222');
      await userEvent.type(screen.getByLabelText(/Mês/i), '12');
      await userEvent.type(screen.getByLabelText(/Ano/i), '2026');
      await userEvent.type(screen.getByLabelText(/CVV/i), '123');
      await userEvent.type(screen.getByLabelText(/CEP/i), '12345678');
      await userEvent.type(screen.getByLabelText(/^Número$/i), '100'); // Use exato match para evitar confusão com 'Número do cartão'
      
      // Mocka o submit
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paymentStatus: 'CONFIRMED' }),
      });

      const submitBtn = screen.getByRole('button', { name: /Pagar com cartão/i });
      await userEvent.click(submitBtn);
      
      // Verifica sucesso
      await waitFor(() => {
        expect(screen.getByText('Pagamento processado')).toBeTruthy();
      });
    });
  });

  describe('Ambiente de Teste (Confirmação Manual)', () => {
    it('deve exibir botão de confirmação manual quando houver um paymentId no PIX', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ // checkout POST
          ok: true,
          json: async () => ({
            paymentId: 'pay_manual_pix',
            value: 150,
          }),
        })
        .mockResolvedValueOnce({ // pix-qr GET
          ok: true,
          json: async () => ({}),
        });

      render(<PaymentModal {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Marcar como Pago \(Simular Asaas\)/i)).toBeTruthy();
      });

      // Simula o clique no botão de confirmação manual
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const confirmBtn = screen.getByText(/Marcar como Pago \(Simular Asaas\)/i);
      await userEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/Consulta Confirmada!/i)).toBeTruthy();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/payments/pay_manual_pix/confirm'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('deve exibir botão de confirmação manual após processar o cartão', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      
      render(<PaymentModal {...props} />);
      await userEvent.click(screen.getByRole('button', { name: /Cartão/i }));
      
      // Mocka o submit do cartão
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paymentId: 'pay_manual_card', paymentStatus: 'CONFIRMED' }),
      });

      // Preencher campos mínimos
      await userEvent.type(screen.getByLabelText(/Nome no cartão/i), 'Paciente Pagador');
      await userEvent.type(screen.getByLabelText(/Número do cartão/i), '5555444433332222');
      await userEvent.type(screen.getByLabelText(/Mês/i), '12');
      await userEvent.type(screen.getByLabelText(/Ano/i), '2026');
      await userEvent.type(screen.getByLabelText(/CVV/i), '123');
      await userEvent.type(screen.getByLabelText(/CEP/i), '12345678');
      await userEvent.type(screen.getByLabelText(/^Número$/i), '100');

      const submitBtn = screen.getByRole('button', { name: /Pagar com cartão/i });
      await userEvent.click(submitBtn);

      // Aguarda tela de sucesso do cartão
      await waitFor(() => {
        expect(screen.getByText('Pagamento processado')).toBeTruthy();
      });

      // Deve mostrar o botão de confirmação manual agora que tem paymentId do cartão
      expect(screen.getByText(/Marcar como Pago \(Simular Asaas\)/i)).toBeTruthy();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await userEvent.click(screen.getByText(/Marcar como Pago \(Simular Asaas\)/i));

      await waitFor(() => {
        expect(screen.getByText(/Consulta Confirmada!/i)).toBeTruthy();
      });
    });
  });
});