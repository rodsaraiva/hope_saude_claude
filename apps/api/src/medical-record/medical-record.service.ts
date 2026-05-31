import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CryptographyService } from '../common/cryptography.service';
import { SignatureProvider } from '../common/signature.provider';
import { sanitizeMedicalHtml } from '../common/html-sanitizer';

/**
 * MedicalRecordService.
 *
 * LGPD: o campo `content` é encriptado em repouso via AES-256-GCM
 * (CryptographyService) — qualquer leitura passa por decryptOne()
 * antes de devolver ao chamador. O fluxo de assinatura digital exige
 * o conteúdo em texto puro (signatureProvider.sign), portanto a
 * decriptação sempre precede o sign().
 *
 * Importante: o conteúdo das auditorias (MedicalRecordAudit) também
 * é encriptado, mas é gravado já no formato armazenado (não decripta /
 * re-encripta), evitando exposição e gasto extra.
 */
@Injectable()
export class MedicalRecordService {
  constructor(
    private prisma: PrismaService,
    private cryptoService: CryptographyService,
    @Inject('SignatureProvider') private signatureProvider: SignatureProvider,
  ) {}

  /** Decripta o campo content de um record. Retorna o objeto modificado. */
  private decryptOne<T extends { content?: string | null } | null>(record: T): T {
    if (!record) return record;
    return { ...record, content: this.cryptoService.decryptNullable(record.content) } as T;
  }

  async create(data: {
    doctorId: number;
    patientId: number;
    appointmentId?: number;
    content: string;
    type?: string;
    template?: 'FREE' | 'SOAP';
  }) {
    if (data.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: data.appointmentId },
      });

      if (!appointment) {
        throw new NotFoundException('Agendamento não encontrado');
      }

      if (appointment.doctorId !== data.doctorId) {
        throw new ForbiddenException('Este agendamento não pertence a este médico');
      }

      if (appointment.patientId !== data.patientId) {
        throw new BadRequestException('Paciente não corresponde ao agendamento');
      }
    } else {
      const hasRelation = await this.prisma.appointment.findFirst({
        where: { doctorId: data.doctorId, patientId: data.patientId },
      });

      if (!hasRelation) {
        throw new ForbiddenException(
          'Você não possui agendamentos com este paciente para criar um prontuário',
        );
      }
    }

    const sanitized = sanitizeMedicalHtml(data.content);
    const encryptedContent = this.cryptoService.encryptNullable(sanitized);

    const created = await this.prisma.medicalRecord.create({
      data: {
        doctorId: data.doctorId,
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        content: encryptedContent as string,
        status: 'DRAFT',
        type: data.type || 'EVOLUTION',
        template: data.template ?? 'FREE',
      },
    });

    return this.decryptOne(created);
  }

  async findAllByPatient(doctorId: number | undefined, patientId: number, search?: string) {
    const where: { patientId: number; doctorId?: number; content?: { contains: string } } = {
      patientId,
    };

    if (doctorId !== undefined) {
      where.doctorId = doctorId;
    }

    // OBS: search por content não funciona após criptografia.
    // Mantido por compatibilidade — busca apenas em registros legados em texto puro
    // ou padrão exato de ciphertext (uso prático limitado). Refatorar com índice
    // separado de busca seria objeto de uma sprint futura.
    if (search) {
      where.content = { contains: search };
    }

    const records = await this.prisma.medicalRecord.findMany({
      where,
      include: { audits: true, doctor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.decryptOne(r));
  }

  async findOne(doctorId: number, recordId: number) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: recordId },
      include: { audits: true },
    });

    if (!record) {
      throw new NotFoundException('Prontuário não encontrado');
    }

    if (record.doctorId !== doctorId) {
      throw new ForbiddenException('Você não tem permissão para visualizar este prontuário');
    }

    return this.decryptOne(record);
  }

  async update(
    doctorId: number,
    recordId: number,
    content: string,
    reason: string = 'Atualização do prontuário',
  ) {
    // Lê direto do prisma (NÃO usa findOne) para preservar o content já
    // encriptado — vamos persistir essa versão encriptada na auditoria.
    const stored = await this.prisma.medicalRecord.findUnique({
      where: { id: recordId },
    });

    if (!stored) {
      throw new NotFoundException('Prontuário não encontrado');
    }

    if (stored.doctorId !== doctorId) {
      throw new ForbiddenException('Você não tem permissão para visualizar este prontuário');
    }

    if (stored.status === 'SIGNED') {
      throw new ForbiddenException('Não é possível editar um prontuário já assinado');
    }

    const newEncryptedContent = this.cryptoService.encryptNullable(
      sanitizeMedicalHtml(content),
    ) as string;

    // Usar transação para garantir auditoria
    const updated = await this.prisma.$transaction(async (tx) => {
      // Salva versão antiga (já encriptada) na auditoria
      await tx.medicalRecordAudit.create({
        data: {
          medicalRecordId: recordId,
          content: stored.content,
          changedByUserId: doctorId,
          reason,
        },
      });

      return tx.medicalRecord.update({
        where: { id: recordId },
        data: { content: newEncryptedContent },
      });
    });

    return this.decryptOne(updated);
  }

  async sign(doctorId: number, recordId: number, authData?: unknown) {
    const record = await this.findOne(doctorId, recordId);

    if (record.status === 'SIGNED') {
      return record;
    }

    // record.content já está DECRIPTADO (findOne fez isso) — fluxo correto
    // para alimentar o provedor de assinatura digital.
    const result = await this.signatureProvider.sign(record.content, authData);

    const updated = await this.prisma.medicalRecord.update({
      where: { id: recordId },
      data: {
        status: 'SIGNED',
        signature: result.signature,
        signatureDate: result.signatureDate,
        signedHash: result.hash,
        signerUserId: doctorId,
      },
    });

    return this.decryptOne(updated);
  }
}
