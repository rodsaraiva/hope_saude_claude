import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { LacunaProvider } from './lacuna.provider';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    isAxiosError: jest.fn(),
  },
}));
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LacunaProvider', () => {
  let provider: LacunaProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LacunaProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'LACUNA_API_URL') return 'https://mock.pki.rest/api';
              if (key === 'LACUNA_API_KEY') return 'mock-api-key';
              return null;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<LacunaProvider>(LacunaProvider);
    (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve chamar a API do Lacuna Rest PKI e retornar a assinatura', async () => {
    const code = 'auth-code-123';
    const content = 'Receita do paciente';
    const signatureResponse = 'CMS-BASE64-SIGNATURE';

    mockedAxios.post.mockResolvedValueOnce({
      data: {
        signature: signatureResponse,
        signer: { name: 'Dr. Silva (BirdID/VidaaS)' },
      },
    });

    const result = await provider.sign(content, { code });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://mock.pki.rest/api/signatures/complete',
      expect.objectContaining({
        code,
        hash: expect.any(String),
        algorithm: 'SHA256',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-api-key' }),
        timeout: 30000,
      }),
    );

    expect(result.signature).toBe(signatureResponse);
    expect(result.signerInfo).toBe('Dr. Silva (BirdID/VidaaS)');
    expect(result.hash).toBeDefined();
    expect(result.signatureDate).toBeInstanceOf(Date);
  });

  it('deve lançar erro se a API do Lacuna falhar (não-HTTP)', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('timeout of 30000ms exceeded'));

    await expect(provider.sign('conteudo', { code: '123' })).rejects.toThrow(/timeout/);
  });

  it('traduz erro HTTP 401 em ServiceUnavailableException com mensagem do Lacuna', async () => {
    const axiosErr = {
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: {
        status: 401,
        data: { message: 'Authorization code expired' },
      },
    };
    mockedAxios.post.mockRejectedValueOnce(axiosErr);
    (mockedAxios.isAxiosError as unknown as jest.Mock).mockReturnValueOnce(true);

    await expect(provider.sign('content', { code: 'expired' })).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('lança erro quando authData.code ausente', async () => {
    await expect(provider.sign('content', {} as unknown as { code: string })).rejects.toThrow(
      /Código de autorização do Lacuna ausente/,
    );
  });

  it('lança erro quando Lacuna retorna 200 mas sem campo signature', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { signer: { name: 'X' } }, // sem signature
    });

    await expect(provider.sign('content', { code: 'abc' })).rejects.toThrow(/sem campo signature/);
  });

  describe('inicialização', () => {
    it('lança erro quando LACUNA_API_KEY não está configurada', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            LacunaProvider,
            {
              provide: ConfigService,
              useValue: { get: jest.fn().mockReturnValue(undefined) },
            },
          ],
        }).compile(),
      ).rejects.toThrow(/LACUNA_API_KEY não está configurada/);
    });

    it('lança erro quando LACUNA_API_KEY é string vazia', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            LacunaProvider,
            {
              provide: ConfigService,
              useValue: { get: jest.fn().mockReturnValue('   ') },
            },
          ],
        }).compile(),
      ).rejects.toThrow(/LACUNA_API_KEY não está configurada/);
    });
  });
});
