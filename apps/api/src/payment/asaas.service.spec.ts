import { Test, TestingModule } from '@nestjs/testing';
import { AsaasService } from './asaas.service';
import { ConfigService } from '@nestjs/config';

function buildConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('AsaasService', () => {
  let service: AsaasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsaasService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ASAAS_API_URL') return 'https://sandbox.asaas.com/api/v3';
              // Chave real para exercitar o caminho de fetch (isMock=false fora de mock).
              if (key === 'ASAAS_API_KEY') return 'real_test_key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AsaasService>(AsaasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find customer id by CPF via list endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: [{ id: 'cus_from_list' }] }),
    } as any);

    const id = await service.findCustomerIdByCpf('123.456.789-09');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/customers?cpfCnpj=12345678909'),
      expect.any(Object),
    );
    expect(id).toBe('cus_from_list');
  });

  it('should return null when list customer by CPF fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: jest.fn().mockResolvedValue('err'),
    } as any);

    const id = await service.findCustomerIdByCpf('12345678909');
    expect(id).toBeNull();
  });

  it('should create a customer in Asaas', async () => {
    // Mockando o fetch global
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'cus_123', object: 'customer' }),
    } as any);

    const customer = await service.createCustomer('John Doe', 'john@test.com', '12345678909');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/customers'),
      expect.any(Object),
    );
    expect(customer.id).toBe('cus_123');
  });

  it('should create a PIX payment', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'pay_123', invoiceUrl: 'http://asaas.com/i/123' }),
    } as any);

    const payment = await service.createPayment('cus_123', 150, 'PIX', 'Consulta Psiquiátrica');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/payments'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const call = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.billingType).toBe('PIX');
    expect(body.creditCard).toBeUndefined();
    expect(payment.id).toBe('pay_123');
    expect(payment.invoiceUrl).toBe('http://asaas.com/i/123');
  });

  it('should create a credit card payment with holder info', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'pay_cc',
        invoiceUrl: 'http://asaas.com/i/cc',
        status: 'CONFIRMED',
      }),
    } as any);

    const cardPayload = {
      creditCard: {
        holderName: 'João Silva',
        number: '5162306219378829',
        expiryMonth: '12',
        expiryYear: '2030',
        ccv: '318',
      },
      creditCardHolderInfo: {
        name: 'João Silva',
        email: 'joao@test.com',
        cpfCnpj: '12345678909',
        postalCode: '01310100',
        addressNumber: '100',
        mobilePhone: '11999999999',
      },
    };

    const payment = await service.createPayment(
      'cus_123',
      150,
      'CREDIT_CARD',
      'Consulta',
      cardPayload,
    );

    const call = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.billingType).toBe('CREDIT_CARD');
    expect(body.creditCard).toEqual(cardPayload.creditCard);
    expect(body.creditCardHolderInfo).toEqual(cardPayload.creditCardHolderInfo);
    expect(payment.status).toBe('CONFIRMED');
  });

  it('should get payment status from Asaas', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'pay_123', status: 'RECEIVED' }),
    } as any);

    const payment = await service.getPaymentStatus('pay_123');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/payments/pay_123'),
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(payment.status).toBe('RECEIVED');
  });

  it('should get PIX QR code data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        encodedImage: 'base64_qr_code',
        payload: 'pix_copy_paste_code',
        expirationDate: '2026-04-03T10:00:00Z',
      }),
    } as any);

    const pixData = await service.getPixQrCode('pay_123');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/payments/pay_123/pixQrCode'),
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(pixData.encodedImage).toBe('base64_qr_code');
    expect(pixData.payload).toBe('pix_copy_paste_code');
  });

  it('should call receiveInSandbox endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'pay_123', status: 'RECEIVED' }),
    } as any);

    const result = await service.receiveInSandbox('pay_123');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/payments/pay_123/receiveInSandbox'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result.status).toBe('RECEIVED');
  });

  describe('fail-fast no boot + isMock() restrito', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('lança no construtor quando ASAAS_API_KEY falta em produção', () => {
      process.env.NODE_ENV = 'production';
      expect(() => new AsaasService(buildConfig({}))).toThrow(/ASAAS_API_KEY/);
    });

    it('constrói normalmente em produção quando ASAAS_API_KEY está presente', () => {
      process.env.NODE_ENV = 'production';
      expect(() => new AsaasService(buildConfig({ ASAAS_API_KEY: 'real_key' }))).not.toThrow();
    });

    it('em test sem chave usa MOCK e getPaymentStatus retorna RECEIVED', async () => {
      process.env.NODE_ENV = 'test';
      const svc = new AsaasService(buildConfig({}));
      await expect(svc.getPaymentStatus('pay_x')).resolves.toEqual({
        id: 'pay_x',
        status: 'RECEIVED',
      });
    });

    it('em development com chave real NÃO usa MOCK (createCustomer não retorna mock id)', async () => {
      process.env.NODE_ENV = 'development';
      const svc = new AsaasService(buildConfig({ ASAAS_API_KEY: 'real_key' }));
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ id: 'cus_real' }), { status: 200 }));

      const result = await svc.createCustomer('Nome', 'a@b.com', '12345678909');

      expect(fetchSpy).toHaveBeenCalled();
      expect(result).toEqual({ id: 'cus_real' });
      fetchSpy.mockRestore();
    });
  });
});
