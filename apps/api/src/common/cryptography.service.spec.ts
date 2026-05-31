import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptographyService } from './cryptography.service';

describe('CryptographyService', () => {
  let service: CryptographyService;

  const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 32 bytes hex

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptographyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              if (key === 'DATA_ENCRYPTION_KEY') return TEST_ENCRYPTION_KEY;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CryptographyService>(CryptographyService);
  });

  it('deve gerar o mesmo hash para o mesmo conteúdo', () => {
    const content = 'Teste de conteúdo';
    const hash1 = service.hashContent(content);
    const hash2 = service.hashContent(content);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('deve gerar hashes diferentes para conteúdos diferentes', () => {
    const hash1 = service.hashContent('A');
    const hash2 = service.hashContent('B');
    expect(hash1).not.toBe(hash2);
  });

  it('deve gerar uma assinatura válida que pode ser verificada', () => {
    const content = 'Relatório médico importante';
    const metadata = 'doctorId:1|date:2026-04-03';

    const signature = service.sign(content, metadata);
    expect(signature).toBeDefined();

    const isValid = service.verify(content, metadata, signature);
    expect(isValid).toBe(true);
  });

  it('deve falhar na verificação se o conteúdo mudar', () => {
    const content = 'Original';
    const metadata = 'm';
    const signature = service.sign(content, metadata);

    const isValid = service.verify('Modificado', metadata, signature);
    expect(isValid).toBe(false);
  });

  it('deve falhar na verificação se os metadados mudarem', () => {
    const content = 'Original';
    const metadata = 'm1';
    const signature = service.sign(content, metadata);

    const isValid = service.verify(content, 'm2', signature);
    expect(isValid).toBe(false);
  });

  describe('encrypt/decrypt (AES-256-GCM)', () => {
    it('faz roundtrip: decrypt(encrypt(x)) === x', () => {
      const plain = '123.456.789-00';
      const cipher = service.encrypt(plain);
      expect(cipher).not.toBe(plain);
      expect(service.decrypt(cipher)).toBe(plain);
    });

    it('produz ciphertexts diferentes para o mesmo plaintext (IV aleatório)', () => {
      const plain = 'segredo';
      const a = service.encrypt(plain);
      const b = service.encrypt(plain);
      expect(a).not.toBe(b);
      expect(service.decrypt(a)).toBe(plain);
      expect(service.decrypt(b)).toBe(plain);
    });

    it('decrypt com ciphertext corrompido lança erro', () => {
      const cipher = service.encrypt('xyz');
      const corrupted = cipher.slice(0, -4) + 'aaaa';
      expect(() => service.decrypt(corrupted)).toThrow();
    });

    it('preserva null/undefined sem alteração', () => {
      expect(service.encryptNullable(null)).toBeNull();
      expect(service.encryptNullable(undefined)).toBeNull();
      expect(service.decryptNullable(null)).toBeNull();
      expect(service.decryptNullable(undefined)).toBeNull();
    });

    it('encryptNullable + decryptNullable fazem roundtrip para strings válidas', () => {
      const plain = 'abc';
      const cipher = service.encryptNullable(plain);
      expect(cipher).not.toBe(plain);
      expect(service.decryptNullable(cipher)).toBe(plain);
    });

    it('lança erro quando DATA_ENCRYPTION_KEY está ausente', async () => {
      const moduleNoKey = await Test.createTestingModule({
        providers: [
          CryptographyService,
          {
            provide: ConfigService,
            useValue: {
              get: jest
                .fn()
                .mockImplementation((key: string) =>
                  key === 'JWT_SECRET' ? 'test-secret' : undefined,
                ),
            },
          },
        ],
      }).compile();

      const svc = moduleNoKey.get<CryptographyService>(CryptographyService);
      expect(() => svc.encrypt('x')).toThrow(/DATA_ENCRYPTION_KEY/);
    });
  });

  it('lança quando JWT_SECRET está ausente (sem fallback inseguro)', async () => {
    await expect(
      Test.createTestingModule({
        providers: [
          CryptographyService,
          {
            provide: ConfigService,
            useValue: {
              get: jest
                .fn()
                .mockImplementation((key: string) =>
                  key === 'DATA_ENCRYPTION_KEY' ? TEST_ENCRYPTION_KEY : undefined,
                ),
            },
          },
        ],
      }).compile(),
    ).rejects.toThrow(/JWT_SECRET/);
  });
});
