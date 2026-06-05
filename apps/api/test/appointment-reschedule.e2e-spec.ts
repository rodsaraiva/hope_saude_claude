import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../src/prisma.service';
import { AppointmentService } from '../src/appointment/appointment.service';

describe('AppointmentService.reschedule — migração de paymentId (DB real)', () => {
  let prisma: PrismaService;
  let service: AppointmentService;
  let doctorId: number;
  let patientId: number;
  const stamp = Date.now();

  const slotA = new Date('2031-04-10T14:00:00.000Z');
  const slotB = new Date('2031-04-11T14:00:00.000Z');
  const slotC = new Date('2031-04-12T14:00:00.000Z');
  const slotA2 = new Date('2031-04-13T14:00:00.000Z');
  const testSlots = [slotA, slotB, slotC, slotA2];

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AppointmentService(prisma);

    // limpa resíduos de execuções anteriores
    await prisma.appointment.deleteMany({ where: { date: { in: testSlots } } });

    const doc = await prisma.user.create({
      data: { email: `rs-doc-${stamp}@test.local`, password: 'x', name: 'Doc RS', role: 'DOCTOR' },
    });
    const pat = await prisma.user.create({
      data: { email: `rs-pat-${stamp}@test.local`, password: 'x', name: 'Pat RS', role: 'PATIENT' },
    });
    doctorId = doc.id;
    patientId = pat.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { date: { in: testSlots } } });
    await prisma.user.deleteMany({ where: { id: { in: [doctorId, patientId] } } });
    await prisma.$disconnect();
  });

  it('migra o paymentId para a nova consulta sem violar @unique', async () => {
    const paymentId = `resched-${stamp}`;

    const old = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        date: slotA,
        status: 'CONFIRMED',
        paymentId,
        durationMinutes: 60,
        price: 150,
      },
    });

    const newAppt = await service.reschedule(old.id, patientId, 'PATIENT', slotB);

    // nova consulta deve ter migrado o paymentId e o novo horário
    expect(newAppt.status).toBe('CONFIRMED');
    expect(newAppt.paymentId).toBe(paymentId);
    expect(newAppt.date.getTime()).toBe(slotB.getTime());

    // consulta antiga deve estar CANCELLED com paymentId = null
    const cancelled = await prisma.appointment.findUnique({ where: { id: old.id } });
    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.paymentId).toBeNull();
    // Se a migração do paymentId fosse feita sem zerá-lo antes, a chamada
    // acima já teria lançado P2002 (unique constraint). Chegar aqui confirma
    // que a transação executa na ordem correta: null first, then create.
  });

  it('reagendar para slot ocupado lança ConflictException', async () => {
    const paymentIdC = `resched-c-${stamp}`;
    const paymentIdA2 = `resched-a2-${stamp}`;

    // slot C já tem uma consulta ATIVA
    await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        date: slotC,
        status: 'CONFIRMED',
        paymentId: paymentIdC,
        durationMinutes: 60,
        price: 150,
      },
    });

    // consulta que tentaremos mover para o slot ocupado
    const toMove = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        date: slotA2,
        status: 'CONFIRMED',
        paymentId: paymentIdA2,
        durationMinutes: 60,
        price: 150,
      },
    });

    await expect(
      service.reschedule(toMove.id, patientId, 'PATIENT', slotC),
    ).rejects.toThrow(ConflictException);

    await expect(
      service.reschedule(toMove.id, patientId, 'PATIENT', slotC),
    ).rejects.toThrow(/já está reservado/);
  });
});
