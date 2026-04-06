import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LacunaProvider } from './lacuna.provider';

jest.mock('axios');
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
        hash: expect.any(String), // Hash gerado internamente
        algorithm: 'SHA256',
      }),
      expect.objectContaining({
        headers: { Authorization: 'Bearer mock-api-key' },
      })
    );

    expect(result.signature).toBe(signatureResponse);
    expect(result.signerInfo).toBe('Dr. Silva (BirdID/VidaaS)');
    expect(result.hash).toBeDefined();
    expect(result.signatureDate).toBeInstanceOf(Date);
  });

  it('deve lançar erro se a API do Lacuna falhar', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('Lacuna API Error'));

    await expect(provider.sign('conteudo', { code: '123' })).rejects.toThrow('Lacuna API Error');
  });
});
