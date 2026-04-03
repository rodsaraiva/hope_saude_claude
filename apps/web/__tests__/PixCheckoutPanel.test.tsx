import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PixCheckoutPanel, { PixCheckoutData } from '../src/components/PixCheckoutPanel';

describe('PixCheckoutPanel', () => {
  const mockData: PixCheckoutData = {
    paymentId: 'pay_123',
    value: 150,
    pixCode: '00020126580014br.gov.bcb.pix0136e2e-test',
    pixQrCode: 'base64qrmock',
    pixExpiresAt: '2026-12-31T23:59:59.000Z',
    invoiceUrl: 'http://asaas.com/mock-invoice',
  };

  const originalClipboard = navigator.clipboard;

  beforeAll(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(),
      },
    });
  });

  afterAll(() => {
    Object.assign(navigator, { clipboard: originalClipboard });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve renderizar o loading e skeleton se qrLoading for true e não houver erro', () => {
    render(<PixCheckoutPanel data={{}} qrLoading={true} />);
    
    expect(screen.getByText('Pagamento PIX')).toBeTruthy();
    expect(screen.getByText('Gerando QR…')).toBeTruthy();
    expect(screen.getByRole('button', { name: /copiar/i })).toHaveProperty('disabled', true);
    expect(screen.getByText('Aguardando código PIX…')).toBeTruthy();
  });

  it('deve exibir mensagem de erro se qrFetchError existir e ocultar loading', () => {
    render(<PixCheckoutPanel data={{}} qrFetchError="Falha ao gerar código PIX" qrLoading={true} />);
    
    expect(screen.queryByText('Gerando QR…')).toBeNull();
    expect(screen.getByText('Falha ao gerar código PIX')).toBeTruthy();
    expect(screen.getByRole('button', { name: /copiar/i })).toHaveProperty('disabled', true);
  });

  it('deve renderizar dados PIX e permitir copiar quando estiver carregado', async () => {
    render(<PixCheckoutPanel data={mockData} />);
    
    // Verifica conteúdo visual renderizado
    expect(screen.getByText('Valor: R$ 150,00')).toBeTruthy();
    expect(screen.getByText(/Válido até/)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'QR Code PIX' })).toBeTruthy();
    
    // Verifica o código e o botão
    const output = screen.getByRole('status'); // aria-live
    expect(output.textContent).toContain(mockData.pixCode!);
    
    const copyButton = screen.getByRole('button', { name: /copiar/i });
    expect(copyButton).toHaveProperty('disabled', false);

    // Testa ação de cópia
    await userEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockData.pixCode);
    
    // Verifica mudança temporária do botão
    expect(screen.getByRole('button', { name: /copiado/i })).toBeTruthy();
    
    // Verifica a restauração após os 2s timeout definidos no componente
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
    }, { timeout: 2500 });
  });

  it('deve mostrar link para fatura externa', () => {
    render(<PixCheckoutPanel data={mockData} />);
    const invoiceLink = screen.getByRole('link', { name: /abrir fatura/i });
    expect(invoiceLink).toBeTruthy();
    expect(invoiceLink.getAttribute('href')).toBe(mockData.invoiceUrl);
  });
});
