import { Test } from '@nestjs/testing';
import { PatientProfileRepository } from './patient-profile.repository';
import { PrismaService } from '../../prisma.service';
import { CryptographyService } from '../../common/cryptography.service';

describe('PatientProfileRepository', () => {
  let repo: PatientProfileRepository;
  let prisma: { patientProfile: { findUnique: jest.Mock; upsert: jest.Mock; update: jest.Mock } };
  let crypto: { encryptNullable: jest.Mock; decryptNullable: jest.Mock };

  beforeEach(async () => {
    prisma = {
      patientProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };
    crypto = {
      encryptNullable: jest.fn((v) => (v == null ? null : `ENC(${v})`)),
      decryptNullable: jest.fn((v) => {
        if (v == null) return null;
        const m = /^ENC\((.*)\)$/.exec(v);
        return m ? m[1] : v;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PatientProfileRepository,
        { provide: PrismaService, useValue: prisma },
        { provide: CryptographyService, useValue: crypto },
      ],
    }).compile();

    repo = moduleRef.get(PatientProfileRepository);
  });

  describe('findByUserId', () => {
    it('retorna null quando não encontra', async () => {
      prisma.patientProfile.findUnique.mockResolvedValue(null);
      expect(await repo.findByUserId(10)).toBeNull();
    });

    it('decripta o CPF antes de retornar', async () => {
      prisma.patientProfile.findUnique.mockResolvedValue({
        id: 1,
        userId: 10,
        cpf: 'ENC(12345678909)',
        phone: '11999999999',
      });

      const result = await repo.findByUserId(10);
      expect(crypto.decryptNullable).toHaveBeenCalledWith('ENC(12345678909)');
      expect(result?.cpf).toBe('12345678909');
    });

    it('aceita include opcional (ex: user)', async () => {
      prisma.patientProfile.findUnique.mockResolvedValue({ id: 1, userId: 10, cpf: null });
      await repo.findByUserId(10, { include: { user: true } });
      expect(prisma.patientProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 10 },
        include: { user: true },
      });
    });
  });

  describe('upsertByUserId', () => {
    it('encripta CPF antes de persistir e decripta no retorno', async () => {
      const data = { cpf: '12345678909', phone: '11999999999' };
      prisma.patientProfile.upsert.mockResolvedValue({
        id: 1,
        userId: 5,
        cpf: 'ENC(12345678909)',
        phone: '11999999999',
      });

      const result = await repo.upsertByUserId(5, data);

      expect(crypto.encryptNullable).toHaveBeenCalledWith('12345678909');
      expect(prisma.patientProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 5 },
        update: { cpf: 'ENC(12345678909)', phone: '11999999999' },
        create: { cpf: 'ENC(12345678909)', phone: '11999999999', userId: 5 },
      });
      expect(result.cpf).toBe('12345678909');
    });

    it('não toca no CPF se não foi fornecido no payload', async () => {
      prisma.patientProfile.upsert.mockResolvedValue({ id: 1, userId: 5, cpf: null });
      await repo.upsertByUserId(5, { phone: '999' });
      expect(crypto.encryptNullable).not.toHaveBeenCalled();
    });
  });

  describe('updateAsaasCustomerId', () => {
    it('atualiza apenas o asaasCustomerId e retorna decriptado', async () => {
      prisma.patientProfile.update.mockResolvedValue({
        id: 1,
        userId: 5,
        cpf: 'ENC(111)',
        asaasCustomerId: 'cus_new',
      });

      const result = await repo.updateAsaasCustomerId(5, 'cus_new');

      expect(prisma.patientProfile.update).toHaveBeenCalledWith({
        where: { userId: 5 },
        data: { asaasCustomerId: 'cus_new' },
      });
      expect(result.cpf).toBe('111');
    });
  });
});
