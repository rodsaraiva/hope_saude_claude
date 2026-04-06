import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptographyService } from './cryptography.service';

describe('CryptographyService', () => {
  let service: CryptographyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptographyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
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
});
