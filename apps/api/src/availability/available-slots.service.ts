import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProfileService } from '../profile/profile.service';
import { AppointmentService } from '../appointment/appointment.service';
import {
  parseAvailabilityJson,
  expandWeeklySlotsInRange,
  subtractBusyFromCandidates,
  type TimeIntervalMs,
} from './weekly-availability';

export const DEFAULT_DOCTOR_TIME_ZONE = 'America/Sao_Paulo';

/** Duração padrão da consulta para bloquear a agenda (alinhado ao slot típico de 1h). */
export const DEFAULT_CONSULTATION_DURATION_MS = 60 * 60 * 1000;

/** Incremento entre horários de início selecionáveis (ex.: a cada 15 min). */
export const DEFAULT_SELECTABLE_STEP_MS = 15 * 60 * 1000;

export type AvailableSlotDto = {
  start: string;
  end: string;
};

@Injectable()
export class AvailableSlotsService {
  constructor(
    private readonly profileService: ProfileService,
    private readonly appointmentService: AppointmentService,
  ) {}

  async getAvailableSlots(
    doctorUserId: number,
    from: Date,
    to: Date,
    timeZone: string = DEFAULT_DOCTOR_TIME_ZONE,
    durationMinutes?: number,
  ): Promise<{ timeZone: string; slots: AvailableSlotDto[] }> {
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('Parâmetro "from" deve ser anterior ou igual a "to"');
    }

    const durationMs = durationMinutes
      ? durationMinutes * 60 * 1000
      : DEFAULT_CONSULTATION_DURATION_MS;

    const profile = await this.profileService.getDoctorProfileByUserId(doctorUserId);
    if (!profile) {
      throw new NotFoundException('Médico não encontrado');
    }

    const weekly = parseAvailabilityJson(profile.availability ?? null);
    const candidates = expandWeeklySlotsInRange(from, to, weekly, timeZone);

    const [appointments, pendingCheckouts] = await Promise.all([
      this.appointmentService.findAppointmentsForDoctorInRange(doctorUserId, from, to),
      this.appointmentService.findPendingCheckoutsForDoctorInRange(doctorUserId, from, to),
    ]);

    const busy = this.buildBusyIntervals(appointments as any, pendingCheckouts as any);
    const free = subtractBusyFromCandidates(candidates, busy);

    const selectable = this.splitIntervalsIntoSelectableSlots(
      free,
      durationMs,
      DEFAULT_SELECTABLE_STEP_MS,
    );

    return {
      timeZone,
      slots: selectable.map((i) => ({
        start: new Date(i.startMs).toISOString(),
        end: new Date(i.endMs).toISOString(),
      })),
    };
  }

  private splitIntervalsIntoSelectableSlots(
    intervals: TimeIntervalMs[],
    durationMs: number,
    stepMs: number,
  ): TimeIntervalMs[] {
    const result: TimeIntervalMs[] = [];
    for (const interval of intervals) {
      let currentStart = interval.startMs;
      while (currentStart + durationMs <= interval.endMs) {
        result.push({
          startMs: currentStart,
          endMs: currentStart + durationMs,
        });
        currentStart += stepMs;
      }
    }
    return result;
  }

  private buildBusyIntervals(
    appointments: { date: Date; durationMinutes?: number }[],
    pendingCheckouts: { date: Date; durationMinutes?: number }[],
  ): TimeIntervalMs[] {
    const rows = [...appointments, ...pendingCheckouts];
    return rows.map((r) => {
      const durMs = (r.durationMinutes || 60) * 60 * 1000;
      return {
        startMs: r.date.getTime(),
        endMs: r.date.getTime() + durMs,
      };
    });
  }
}
