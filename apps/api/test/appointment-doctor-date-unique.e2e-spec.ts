import { PrismaService } from '../src/prisma.service';

describe('Appointment (doctorId,date) — índice unique parcial (DB real)', () => {
  let prisma: PrismaService;
  let doctorId: number;
  let patientId: number;
  let patient2Id: number;
  const slot = new Date('2031-03-09T13:00:00.000Z'); // futuro distante, fora de dados reais
  const stamp = Date.now();
  const createdApptIds: number[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
    prisma = new PrismaService();
    await prisma.$connect();
    // limpa qualquer resíduo de execuções anteriores neste slot
    await prisma.appointment.deleteMany({ where: { date: slot } });
    const doc = await prisma.user.create({
      data: { email: `m6-doc-${stamp}@test.local`, password: 'x', name: 'Doc M6', role: 'DOCTOR' },
    });
    const pat = await prisma.user.create({
      data: { email: `m6-pat-${stamp}@test.local`, password: 'x', name: 'Pat M6', role: 'PATIENT' },
    });
    const pat2 = await prisma.user.create({
      data: { email: `m6-pat2-${stamp}@test.local`, password: 'x', name: 'Pat2 M6', role: 'PATIENT' },
    });
    doctorId = doc.id;
    patientId = pat.id;
    patient2Id = pat2.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { date: slot } });
    await prisma.user.deleteMany({ where: { id: { in: [doctorId, patientId, patient2Id] } } });
    await prisma.$disconnect();
  });

  it('bloqueia duas consultas ATIVAS no mesmo (médico, data)', async () => {
    const a = await prisma.appointment.create({
      data: { patientId, doctorId, date: slot, status: 'CONFIRMED', paymentId: `m6-a-${stamp}` },
    });
    createdApptIds.push(a.id);
    await expect(
      prisma.appointment.create({
        data: { patientId: patient2Id, doctorId, date: slot, status: 'CONFIRMED', paymentId: `m6-b-${stamp}` },
      }),
    ).rejects.toThrow();
  });

  it('permite RE-BOOK do mesmo slot depois que a consulta vira CANCELLED', async () => {
    await prisma.appointment.updateMany({
      where: { doctorId, date: slot, status: 'CONFIRMED' },
      data: { status: 'CANCELLED' },
    });
    const reb = await prisma.appointment.create({
      data: { patientId: patient2Id, doctorId, date: slot, status: 'CONFIRMED', paymentId: `m6-c-${stamp}` },
    });
    createdApptIds.push(reb.id);
    expect(reb.status).toBe('CONFIRMED');
  });
});
