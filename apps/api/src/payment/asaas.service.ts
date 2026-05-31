import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('ASAAS_API_URL') || 'https://sandbox.asaas.com/api/v3';
    const key = this.configService.get<string>('ASAAS_API_KEY');
    if (!key || key.trim() === '') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'ASAAS_API_KEY não está configurada. Pagamentos indisponíveis em produção.',
        );
      }
      this.apiKey = 'MOCK_API_KEY';
    } else {
      this.apiKey = key;
    }
  }

  private isMock(): boolean {
    return this.apiKey === 'MOCK_API_KEY' && process.env.NODE_ENV !== 'production';
  }

  private async asaasFetch(path: string, options: RequestInit): Promise<Response> {
    const url = `${this.apiUrl}${path}`;
    this.logger.log(`Asaas request: ${options.method} ${url}`);
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`Asaas HTTP ${response.status}: ${body}`);
      }
      return response;
    } catch (err: any) {
      this.logger.error(`Asaas fetch error: ${err.message}`);
      if (err.cause)
        this.logger.error(
          `Cause: ${JSON.stringify(err.cause, Object.getOwnPropertyNames(err.cause))}`,
        );
      throw err;
    }
  }

  private get authHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', access_token: this.apiKey };
  }

  /** Busca cliente existente pelo CPF/CNPJ (evita duplicar ao vincular perfil). */
  async findCustomerIdByCpf(cpfCnpj: string): Promise<string | null> {
    if (this.isMock()) return null;

    const digits = cpfCnpj.replace(/\D/g, '');
    if (!digits) return null;

    const response = await this.asaasFetch(`/customers?cpfCnpj=${encodeURIComponent(digits)}`, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { data?: Array<{ id?: string }> };
    const first = body?.data?.[0];
    return first?.id ?? null;
  }

  async createCustomer(name: string, email: string, cpfCnpj?: string) {
    if (this.isMock()) return { id: 'cus_mock_123', object: 'customer' };

    const response = await this.asaasFetch('/customers', {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({ name, email, cpfCnpj }),
    });

    if (!response.ok) {
      throw new HttpException('Falha ao criar cliente no Asaas', HttpStatus.BAD_REQUEST);
    }
    return response.json();
  }

  async createPayment(
    customerId: string,
    value: number,
    billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO',
    description: string,
    card?: {
      creditCard: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
      };
      creditCardHolderInfo: {
        name: string;
        email: string;
        cpfCnpj: string;
        postalCode: string;
        addressNumber: string;
        phone?: string;
        mobilePhone?: string;
      };
    },
  ) {
    if (this.isMock()) {
      return {
        id: 'pay_mock_123',
        invoiceUrl: 'https://sandbox.asaas.com/i/mock_123',
        status: billingType === 'CREDIT_CARD' ? 'CONFIRMED' : 'PENDING',
      };
    }

    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    const dueDate = nextDay.toISOString().split('T')[0];

    const payload: Record<string, unknown> = {
      customer: customerId,
      billingType,
      value,
      dueDate,
      description,
    };

    if (billingType === 'CREDIT_CARD' && card) {
      payload.creditCard = card.creditCard;
      payload.creditCardHolderInfo = card.creditCardHolderInfo;
    }

    const response = await this.asaasFetch('/payments', {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new HttpException('Falha ao criar pagamento no Asaas', HttpStatus.BAD_REQUEST);
    }
    return response.json();
  }

  async getPaymentStatus(paymentId: string) {
    if (this.isMock()) return { id: paymentId, status: 'RECEIVED' };

    const response = await this.asaasFetch(`/payments/${paymentId}`, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      throw new HttpException(
        'Falha ao obter status do pagamento no Asaas',
        HttpStatus.BAD_REQUEST,
      );
    }
    return response.json();
  }

  async getPixQrCode(paymentId: string) {
    if (this.isMock()) {
      return {
        encodedImage: 'mock_base64_qr',
        payload: 'mock_pix_payload',
        expirationDate: '2026-04-03T10:00:00Z',
      };
    }

    const response = await this.asaasFetch(`/payments/${paymentId}/pixQrCode`, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      throw new HttpException('Falha ao obter QR Code PIX no Asaas', HttpStatus.BAD_REQUEST);
    }
    return response.json();
  }

  /** Apenas para Sandbox/Testes: Simula recebimento de pagamento no Asaas. */
  async receiveInSandbox(paymentId: string) {
    if (this.isMock()) return { id: paymentId, status: 'RECEIVED' };

    const response = await this.asaasFetch(`/payments/${paymentId}/receiveInSandbox`, {
      method: 'POST',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      throw new HttpException('Falha ao simular recebimento no Asaas', HttpStatus.BAD_REQUEST);
    }
    return response.json();
  }
}
