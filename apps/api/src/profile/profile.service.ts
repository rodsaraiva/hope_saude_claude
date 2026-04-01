import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async createDoctorProfile(userId: number, data: any) {
    return this.prisma.doctorProfile.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async createPatientProfile(userId: number, data: any) {
    return this.prisma.patientProfile.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  async getDoctorProfile(userId: number) {
    return this.prisma.doctorProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  async getPatientProfile(userId: number) {
    return this.prisma.patientProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
  }

  async updateAvailability(userId: number, availability: string) {
    return this.prisma.doctorProfile.update({
      where: { userId },
      data: { availability },
    });
  }

  async listDoctors(specialty?: string) {
    return this.prisma.doctorProfile.findMany({
      where: specialty ? { specialty } : {},
      include: { user: { select: { name: true, email: true } } },
    });
  }
}
