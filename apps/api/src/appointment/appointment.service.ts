import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AppointmentService {
  constructor(private prisma: PrismaService) {}

  async createAppointment(data: { patientId: number; doctorId: number; date: Date }) {
    return this.prisma.appointment.create({
      data: {
        ...data,
        status: 'PENDING',
      },
    });
  }

  async getPatientAppointments(patientId: number) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { date: 'asc' },
    });
  }

  async getDoctorAppointments(doctorId: number) {
    return this.prisma.appointment.findMany({
      where: { doctorId },
      orderBy: { date: 'asc' },
    });
  }

  async updateStatus(id: number, status: string) {
    return this.prisma.appointment.update({
      where: { id },
      data: { status },
    });
  }

  async findById(id: number) {
    return this.prisma.appointment.findUnique({ where: { id } });
  }
}
