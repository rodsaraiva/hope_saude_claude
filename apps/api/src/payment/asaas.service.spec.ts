import { Test, TestingModule } from '@nestjs/testing';
import { AsaasService } from './asaas.service';
import { ConfigService } from '@nestjs/config';

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
              if (key === 'ASAAS_API_KEY') return 'MOCK_API_KEY';
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
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/customers'), expect.any(Object));
    expect(customer.id).toBe('cus_123');
  });

  it('should create a PIX payment', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'pay_123', invoiceUrl: 'http://asaas.com/i/123' }),
    } as any);

    const payment = await service.createPayment('cus_123', 150, 'PIX', 'Consulta Psiquiátrica');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/payments'), expect.objectContaining({
      method: 'POST',
    }));
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
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/payments/pay_123'), expect.objectContaining({
      method: 'GET'
    }));
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
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/payments/pay_123/pixQrCode'), expect.objectContaining({
      method: 'GET'
    }));
    expect(pixData.encodedImage).toBe('base64_qr_code');
    expect(pixData.payload).toBe('pix_copy_paste_code');
  });

  it('should call receiveInSandbox endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'pay_123', status: 'RECEIVED' }),
    } as any);

    const result = await service.receiveInSandbox('pay_123');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/payments/pay_123/receiveInSandbox'), expect.objectContaining({
      method: 'POST'
    }));
    expect(result.status).toBe('RECEIVED');
  });
});

